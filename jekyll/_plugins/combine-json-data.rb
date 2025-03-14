unless ENV['SKIP_COMBINE_JSON'] == 'true'
  require 'json'
  require 'yaml'
  require_relative 'update_yml'

  module Jekyll
    class CombineData < Generator
      safe true
      priority :high

      def generate(site)
        start_time = Time.now  # added timer start
        combined_albums_data = []
        combined_tracks_on_album_data = []
        data_yml_path = File.join(site.source, '_data', 'data.yml')
        yml_data = YAML.load_file(data_yml_path)
        data_json_path = File.join(site.source, 'assets', 'json', 'data.json')
        data_json = JSON.parse(File.read(data_json_path))
        
        albums_data = yml_data['Albums']
        albums_data.each do |album_data|
          album_slug = Jekyll::Utils.slugify(album_data['Album'])
          album_data['Tracks'].each do |track_data|
            track_json_path = track_data['Track_JSONPath']
            track_data_path = File.join(site.source, 'assets', 'json', album_slug, track_json_path)
            
            if File.exist?(track_data_path)
              begin
                track_data_content = JSON.parse(File.read(track_data_path))
                # Assign the parsed JSON as a new Subtitles key into the current track
                track_data["Subtitles"] = track_data_content
                combined_tracks_on_album_data << track_data
              rescue JSON::ParserError => e
                puts "Error parsing JSON for track_data_path: #{track_data_path}, error: #{e.message.slice(0, 100)}"
              rescue => e
                puts "Error reading file for track_data_path: #{track_data_path}, error: #{e.message.slice(0, 100)}"
              end
            else
              puts "Warning: File does not exist for track_data_path: #{track_data_path.to_s.slice(0, 100)}"
            end
          end

          album_data["Tracks"] = combined_tracks_on_album_data
          combined_albums_data << album_data
          combined_tracks_on_album_data = []
        end  

        combined_data_path = File.join(site.source, 'assets', 'json', 'combined_data.json')
        # Delete the file if it exists
        if File.exist?(combined_data_path)
          File.delete(combined_data_path)
        end
        File.open(combined_data_path, 'w') do |file|
          file.write(JSON.pretty_generate({ "Albums" => combined_albums_data }))
        end
        puts "combine-json-data.rb plugin took #{Time.now - start_time} seconds."  # added runtime output
      end
    end
  end
end