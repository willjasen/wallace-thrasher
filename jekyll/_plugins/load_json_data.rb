require 'json'

module Jekyll
  class LoadJsonData < Generator
    safe true
    priority :highest

    def generate(site)
      # Load JSON files from /assets/json
      json_dir = File.join(site.source, 'assets', 'json', 'best-before--24')

      Dir.glob(File.join(json_dir, '*.json')) do |file|
        data_key = File.basename(file, '.json')
        json_data = JSON.parse(File.read(file))
        site.data[data_key] = json_data
      end

      # Load /assets/data.json
      data_file = File.join(site.source, 'assets', 'data.json')

      if File.exist?(data_file)
        data_json = JSON.parse(File.read(data_file))
        site.data['albums'] = data_json
      else
        puts "Warning: data.json not found at #{data_file}"
      end
    end
  end
end
