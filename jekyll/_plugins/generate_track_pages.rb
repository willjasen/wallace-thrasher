require_relative 'update_yml'
module Jekyll
    class TrackPagesGenerator < Generator
      safe true
      priority :low
  
      def generate(site)
        start_time = Time.now
        albums = site.data['tracks']
        albums.each do |album_data|
          album_data['tracks'].each do |track_data|
              site.collections['tracks'].docs << create_track_doc(site, album_data, track_data)
          end
        end
        puts "\e[34mgenerate_track_pages.rb plugin took #{Time.now - start_time} seconds.\e[0m"
      end
  
      private
  
      def create_track_doc(site, album_data, track_data)
        track_slug = Jekyll::Utils.slugify(track_data['track_title'])
        album_slug = Jekyll::Utils.slugify(album_data['album'])
        
        # Create album subfolder path
        album_dir = File.join('_tracks', album_slug)
        # Create full directory path if it doesn't exist
        FileUtils.mkdir_p(File.join(site.source, album_dir)) unless Dir.exist?(File.join(site.source, album_dir))
        
        filename = "#{track_slug}.md"
        path = File.join(site.source, album_dir, filename)
        doc = Document.new(path, { :site => site, :collection => site.collections['tracks'] })
        doc.data['album_title'] = album_data['album']
        doc.data['album_year'] = album_data['year']
        doc.data['track_title'] = track_data['track_title']
        doc.data['track_number'] = track_data['track_number']
        doc
      end      
    end
  end