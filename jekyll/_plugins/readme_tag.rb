require "time"

module Jekyll
  class ReadmeTag < Liquid::Tag
    CALL_STATS_MARKER = "<!-- TWILIO_CALL_STATS -->"

    def render(context)
      readme_path = File.expand_path("../../README.md", __dir__)
      readme = File.read(readme_path)
      site = context.registers[:site]
      stats = site.data.fetch("twilio_call_stats", {})

      readme.sub(CALL_STATS_MARKER, call_stats_markup(stats, site.config["timezone"]))
    end

    private

    def call_stats_markup(stats, timezone = "UTC")
      return "" unless stats["available"]

      <<~MARKDOWN

      <p class="call-stats" aria-label="Unique hotline callers">
        <strong>#{format_number(stats["total"])} unique callers</strong>
        <span aria-hidden="true">·</span>
        #{format_number(stats["phone"])} by phone
        <span aria-hidden="true">·</span>
        #{format_number(stats["web"])} through the web app
        #{last_call_markup(stats["last_call_at"], timezone)}
      </p>
      MARKDOWN
    end

    def last_call_markup(timestamp, timezone)
      return "" unless timestamp

      original_timezone = ENV["TZ"]
      begin
        ENV["TZ"] = timezone || "UTC"
        time = Time.iso8601(timestamp).getlocal
        %(<span aria-hidden="true">·</span> Last call: #{time.strftime("%B %-d, %Y at %-I:%M %p %Z")})
      rescue ArgumentError
        ""
      ensure
        ENV["TZ"] = original_timezone
      end
    end

    def format_number(number)
      number.to_i.to_s.reverse.scan(/\d{1,3}/).join(",").reverse
    end
  end
end

Liquid::Template.register_tag("readme", Jekyll::ReadmeTag)
