module Jekyll
  class ReadmeTag < Liquid::Tag
    def render(_context)
      readme_path = File.expand_path("../../README.md", __dir__)
      File.read(readme_path)
    end
  end
end

Liquid::Template.register_tag("readme", Jekyll::ReadmeTag)
