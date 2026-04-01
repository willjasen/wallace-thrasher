require 'json'

module Jekyll
  class LoadJsonData < Generator
    safe true
    priority :normal

    def generate(site)
      start_time = Time.now  # added timer start
      # Load JSON files from /assets/json
      json_dir = File.join(site.source, 'assets', 'json')

      # Load data.json at build time (metadata only - no subtitle text)
      # Track pages are rendered client-side from data.combined.json via tracks/index.html
      data_file_path = File.join(json_dir, 'data.json')
      puts "\e[32mLoading data from #{data_file_path}\e[0m"

      if File.exist?(data_file_path)
        file_content = File.read(data_file_path)
        if file_content.strip.empty?
          puts "Warning: data.json is empty."
        else
          data_json = parse_json_safely(file_content)
          site.data['albums'] = data_json
        end
      else
        puts "Warning: data.json not found at #{data_file_path}"
      end
      # puts "\e[34mload_json_data.rb plugin took #{Time.now - start_time} seconds.\e[0m"
    end

    private

    def parse_json_safely(json_string)
      sanitized_string = json_string.encode('UTF-8', invalid: :replace, undef: :replace, replace: '')
      JSON.parse(sanitized_string)
    rescue JSON::ParserError => e
      puts "Error parsing JSON: #{e.message}"
      {}
    end
  end
end
