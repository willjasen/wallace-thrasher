require 'json'
module Jekyll
    class AlbumPagesGenerator < Generator
      safe true
      priority :low
  
      def generate(site)
        start_time = Time.now  # added timer start
        albums = site.data['albums']['Albums']
        data_path = File.join(site.source, 'assets', 'json', 'data.json')
        data_timestamp = Jekyll.git_timestamp(site.source, data_path) || File.mtime(data_path)
        albums.each do |album_data|
            site.collections['albums'].docs << create_album_doc(site, album_data, data_timestamp)
        end
        # puts "\e[34mgenerate_album_pages.rb plugin took #{Time.now - start_time} seconds.\e[0m"
      end
  
      private
  
      def create_album_doc(site, album_data, data_timestamp)
        slug = Jekyll::Utils.slugify(album_data['Album'])
        filename = "#{slug}.md"
        path = File.join(site.source, '_albums', filename)
        doc = Document.new(path, { :site => site, :collection => site.collections['albums'] })
        doc.data['album_title'] = album_data['Album']
        doc.data['album_year'] = album_data['Year']
        doc.data['title'] = "#{album_data['Album']} (#{album_data['Year']})"
        doc.data['description'] = "Track list and subtitle links for #{album_data['Album']} by Longmont Potion Castle."
        doc.data['image'] = "/assets/img/albums/#{album_data['Album_Picture']}"
        track_timestamps = album_data.fetch('Tracks', []).filter_map { |track| track['Last_Modified'].to_i if track['Last_Modified'] }
        doc.data['last_modified_at'] = if track_timestamps.empty?
                                         data_timestamp
                                       else
                                         Time.at(track_timestamps.max)
                                       end
        doc
      end      
    end
  end
