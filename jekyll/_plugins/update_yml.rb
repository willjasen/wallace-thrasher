require 'json'
require 'yaml'
module Jekyll
  class UpdateTracks < Generator
    priority :lowest

    def generate(site)
      start_time = Time.now  # added timer start
      data_file = File.join(site.source, "assets", 'json', 'data.json')
      json_data = JSON.parse(File.read(data_file))
      updated_yaml = json_data.to_yaml
      target_file = File.join(site.source, '_data', 'data.yml')
      File.write(target_file, updated_yaml)
      # puts "\e[34mupdate_yml.rb plugin took #{Time.now - start_time} seconds.\e[0m"
    end
    
  end
end