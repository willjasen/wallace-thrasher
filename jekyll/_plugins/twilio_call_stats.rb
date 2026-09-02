require "json"
require "net/http"
require "set"
require "time"
require "uri"

module Stretchie
  class TwilioCallStats
    API_ORIGIN = "https://api.twilio.com".freeze
    PAGE_SIZE = 1_000

    def initialize(env = ENV)
      @account_sid = env.fetch("TWILIO_ACCOUNT_SID")
      if env["TWILIO_API_KEY"] && env["TWILIO_API_SECRET"]
        @username = env["TWILIO_API_KEY"]
        @password = env["TWILIO_API_SECRET"]
      else
        @username = @account_sid
        @password = env.fetch("TWILIO_AUTH_TOKEN")
      end
      @phone_number = env.fetch("TWILIO_PHONE_NUMBER")
    end

    def fetch
      phone_callers = Set.new
      web_callers = Set.new
      last_call_at = nil

      each_call do |call|
        next unless call["status"] == "completed"

        from = call["from"].to_s
        is_phone_call = call["direction"] == "inbound" && call["to"] == @phone_number
        is_web_call = from.start_with?("client:web_")

        if is_phone_call
          phone_callers.add(from) unless from.empty?
        elsif is_web_call
          web_callers.add(from)
        end

        next unless is_phone_call || is_web_call

        call_time = parse_call_time(call["start_time"] || call["date_created"])
        last_call_at = call_time if call_time && (!last_call_at || call_time > last_call_at)
      end

      {
        "available" => true,
        "total" => phone_callers.size + web_callers.size,
        "phone" => phone_callers.size,
        "web" => web_callers.size,
        "last_call_at" => last_call_at&.utc&.iso8601,
        "generated_at" => Time.now.utc.iso8601
      }
    end

    private

    def parse_call_time(value)
      Time.parse(value.to_s)
    rescue ArgumentError
      nil
    end

    def each_call
      path = "/2010-04-01/Accounts/#{@account_sid}/Calls.json?PageSize=#{PAGE_SIZE}"

      while path
        response = request(path)
        body = JSON.parse(response.body)
        Array(body["calls"]).each { |call| yield call }
        path = body["next_page_uri"]
      end
    end

    def request(path)
      uri = URI.join(API_ORIGIN, path)
      request = Net::HTTP::Get.new(uri)
      request.basic_auth(@username, @password)
      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.open_timeout = 10
        http.read_timeout = 30
        http.request(request)
      end

      return response if response.is_a?(Net::HTTPSuccess)

      raise "Twilio Calls API returned HTTP #{response.code}"
    end
  end

  class TwilioCallStatsGenerator < Jekyll::Generator
    safe true
    priority :highest

    def generate(site)
      site.data["twilio_call_stats"] = if ENV["NETLIFY"] == "true"
        Jekyll.logger.info "Twilio call stats:", "fetching call logs for this Netlify build"
        TwilioCallStats.new.fetch
      else
        { "available" => false }
      end
    rescue KeyError => error
      raise Jekyll::Errors::FatalException,
        "Twilio call stats require a Netlify build variable: #{error.message}"
    rescue StandardError => error
      raise Jekyll::Errors::FatalException,
        "Unable to fetch Twilio call stats: #{error.message}"
    end
  end
end
