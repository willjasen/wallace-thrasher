require_relative 'update_yml'
module Jekyll
    class AlbumsGenerator < Generator
      safe true
  
      def generate(site)
        start_time = Time.now  # added timer start
        albums = site.data['tracks']
        albums.each do |album_data|
            site.collections['albums'].docs << create_album_doc(site, album_data)
        end
        puts "generate_albums.rb plugin took #{Time.now - start_time} seconds."  # added runtime output
      end
  
      private
  
      def create_album_doc(site, album_data)
        slug = Jekyll::Utils.slugify(album_data['album'])
        filename = "#{slug}.md"
        path = File.join(site.source, '_albums', filename)
        doc = Document.new(path, { :site => site, :collection => site.collections['albums'] })
        doc.data['album_title'] = album_data['album']
        doc.data['album_year'] = album_data['year']
        doc
      end      
    end
  end
  