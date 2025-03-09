require 'json'
require 'yaml'

module Jekyll
  class CombineData < Generator
    safe true
    priority :high

    def generate(site)
      combined_data = []
      tracks_file_path = File.join(site.source, '_data', 'data.yml')
      full_data = YAML.load_file(tracks_file_path)

      puts "Full data: #{full_data.to_s.slice(0, 100)}"
      
      albums_data = full_data['Albums']
      albums_data.each do |album_data|
        album_slug = Jekyll::Utils.slugify(album_data['Album'])
        puts "Album slug: #{album_slug}"
        album_data['Tracks'].each do |track_data|
          puts "Track data: #{track_data.to_s.slice(0, 100)}"
          track_json_path = track_data['Track_JSONPath']
          if track_json_path.nil? || track_json_path.empty?
            puts "Warning: track_json_path is empty for track_data: #{track_data.to_s.slice(0, 100)}"
            # next  # Skip processing for this track
          end
          puts "track_json_path: #{track_json_path.to_s.slice(0, 200)}"
          track_data_path = File.join(site.source, '_site', 'assets', 'json', album_slug, track_json_path)
          
          if File.exist?(track_data_path)
            begin
              track_data_content = JSON.parse(File.read(track_data_path))
              puts "Track data: #{track_data_content.to_s.slice(0, 100)}"
              combined_data << track_data_content
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