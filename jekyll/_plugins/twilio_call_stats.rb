require "json"
require "net/http"
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
      phone_calls = 0
      web_calls = 0

      each_call do |call|
        next unless call["status"] == "completed"

        from = call["from"].to_s
        if call["direction"] == "inbound" && call["to"] == @phone_number
          phone_calls += 1
        elsif from.start_with?("client:web_")
          web_calls += 1
        end
      end

      {
        "available" => true,
        "total" => phone_calls + web_calls,
        "phone" => phone_calls,
        "web" => web_calls,
        "generated_at" => Time.now.utc.iso8601
      }
    end

    private

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
