module Jekyll
  class ReadmeTag < Liquid::Tag
    CALL_STATS_MARKER = "<!-- TWILIO_CALL_STATS -->"

    def render(context)
      readme_path = File.expand_path("../../README.md", __dir__)
      readme = File.read(readme_path)
      stats = context.registers[:site].data.fetch("twilio_call_stats", {})

      readme.sub(CALL_STATS_MARKER, call_stats_markup(stats))
    end

    private

    def call_stats_markup(stats)
      return "" unless stats["available"]

      <<~MARKDOWN

      <div class="call-stats" aria-label="Hotline call totals">
        <strong>#{format_number(stats["total"])} calls received</strong>
        <span>#{format_number(stats["phone"])} by phone</span>
        <span>#{format_number(stats["web"])} through the web app</span>
      </div>

      <small class="call-stats__note">Updated with each Netlify build from completed Twilio call logs.</small>
      MARKDOWN
    end

    def format_number(number)
      number.to_i.to_s.reverse.scan(/\d{1,3}/).join(",").reverse
    end
  end
end

Liquid::Template.register_tag("readme", Jekyll::ReadmeTag)
