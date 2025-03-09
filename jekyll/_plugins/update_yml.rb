require 'json'
require 'yaml'
module Jekyll
  class UpdateTracks < Generator
    def generate(site)
      data_file = File.join(site.source, "assets", 'json', 'data.json') 
      json_data = JSON.parse(File.read(data_file))
      updated_yaml = json_data.to_yaml
      target_file = File.join(site.source, '_data', 'data.yml')
      File.write(target_file, updated_yaml)
    end
  end
end