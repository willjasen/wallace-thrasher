require_relative 'update_yml'
module Jekyll
    class TrackPagesGenerator < Generator
      safe true
  
      def generate(site)
        start_time = Time.now  # added timer start
        albums = site.data['tracks']
        albums.each do |album_data|
          album_data['tracks'].each do |track_data|
              site.collections['tracks'].docs << create_track_doc(site, album_data, track_data)
          end
        end
        puts "generate_track_pages.rb plugin took #{Time.now - start_time} seconds."  # added runtime output
      end
  
      private
  
      def create_track_doc(site, album_data, track_data)
        slug = Jekyll::Utils.slugify(track_data['track_title'])
        filename = "#{slug}.md"
        path = File.join(site.source, '_tracks', filename)
        doc = Document.new(path, { :site => site, :collection => site.collections['tracks'] })
        doc.data['album_title'] = album_data['album']
        doc.data['album_year'] = album_data['year']
        doc.data['track_title'] = track_data['track_title']
        doc.data['track_number'] = track_data['track_number']
        doc
      end      
    end
  end