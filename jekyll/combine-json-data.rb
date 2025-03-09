require 'json'

module Jekyll
  class CombineData < Generator
    safe true
    priority :high

    def generate(site)
      combined_data = []

      albums = site.data['tracks']
      albums.each do |album_data|
        album_slug = Jekyll::Utils.slugify(album_data['album'])
        puts "Album slug: #{album_slug}"
        album_data['tracks'].each do |track_data|
          puts "Track data: #{track_data}"
          track_json_path = track_data['Track_JSONPath']
          if track_json_path.nil? || track_json_path.empty?
            puts "Warning: track_json_path is empty for track_data: #{track_data}"
            # next  # Skip processing for this track
          end
          puts "track_json_path: #{track_json_path}"
          track_data_path = File.join(site.source, '_site', 'json', album_slug, track_json_path)
          
          if File.exist?(track_data_path)
            begin
              track_data_content = JSON.parse(File.read(track_data_path))
              puts "Track data: #{track_data_content}"
              combined_data << track_data_content
            rescue JSON::ParserError => e
              puts "Error parsing JSON for track_data_path: #{track_data_path}, error: #{e.message}"
            rescue => e
              puts "Error reading file for track_data_path: #{track_data_path}, error: #{e.message}"
            end
          else
            puts "Warning: File does not exist for track_data_path: #{track_data_path}"
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