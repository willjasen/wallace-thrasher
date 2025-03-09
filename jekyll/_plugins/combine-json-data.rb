require 'json'
require 'yaml'

module Jekyll
  class CombineData < Generator
    safe true
    priority :high

    def generate(site)
      combined_data = []
      data_yml_path = File.join(site.source, '_data', 'data.yml')
      yml_data = YAML.load_file(data_yml_path)
      data_json_path = File.join(site.source, 'assets', 'data.json')
      data_json = JSON.parse(File.read(data_json_path))
      
      albums_data = yml_data['Albums']
      albums_data.each do |album_data|
        album_slug = Jekyll::Utils.slugify(album_data['Album'])
        album_data['Tracks'].each do |track_data|
          track_json_path = track_data['Track_JSONPath']
          if track_json_path.nil? || track_json_path.empty?
            puts "Warning: track_json_path is empty for track_data: #{track_data.to_s.slice(0, 100)}"
            # next  # Skip processing for this track
          end
          track_data_path = File.join(site.source, '_site', 'assets', 'json', album_slug, track_json_path)
          
          if File.exist?(track_data_path)
            begin
              track_data_content = JSON.parse(File.read(track_data_path))
              # Assign the parsed JSON as a new Tracks key into the current track
              track_data["Subtitles"] = track_data_content
              combined_data << track_data
            rescue JSON::ParserError => e
              puts "Error parsing JSON for track_data_path: #{track_data_path}, error: #{e.message.slice(0, 100)}"
            rescue => e
              puts "Error reading file for track_data_path: #{track_data_path}, error: #{e.message.slice(0, 100)}"
            end
          else
            puts "Warning: File does not exist for track_data_path: #{track_data_path.to_s.slice(0, 100)}"
          end
        end
      end

      combined_data_path = File.join(site.source, 'assets', 'combined_data.json')
      File.open(combined_data_path, 'w') do |file|
        file.write(JSON.pretty_generate(combined_data))
      end
    end
  end
end