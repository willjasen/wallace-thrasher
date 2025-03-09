require 'json'
require_relative 'combine-json-data'

module Jekyll
  class LoadJsonData < Generator
    safe true
    priority :highest

    def generate(site)
      # Load JSON files from /assets/json
      json_dir = File.join(site.source, 'assets', 'json')

      if site.config['render_quickly']
        #Dir.glob(File.join(json_dir, '**/*.json')) do |file|
        #  data_key = File.basename(file, '.json')
        #  json_data = JSON.parse(File.read(file))
        #  site.data[data_key] = json_data
        #end
      else
        data_file_path = File.join(json_dir, 'combined_data.json')
        puts "Loading data from #{data_file_path}"

        if File.exist?(data_file_path)
          file_content = File.read(data_file_path)
          if file_content.strip.empty?
            puts "Warning: combined_data.json is empty."
          else
            data_json = JSON.parse(file_content)
            site.data['albums'] = data_json
          end
        else
          puts "Warning: combined_data.json not found at #{data_file_path}"
        end
      end
    end
  end
end
