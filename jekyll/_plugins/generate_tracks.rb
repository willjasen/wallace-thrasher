module Jekyll
    class TracksGenerator < Generator
      safe true
  
      def generate(site)
        albums = site.data['tracks']
        albums.each do |album_data|
          album_data['tracks'].each do |track_data|
              site.collections['tracks'].docs << create_track_doc(site, track_data)
          end
        end
      end
  
      private
  
      def create_track_doc(site, track_data)
        slug = Jekyll::Utils.slugify(track_data['track_title'])
        filename = "#{slug}.md"
        path = File.join(site.source, '_tracks', filename)
        doc = Document.new(path, { :site => site, :collection => site.collections['tracks'] })
        doc.data['title'] = track_data['track_title']
        #doc.data['album'] = track_data['album']
        #doc.data['subtitle'] = track_data['subtitle']
        doc.data['track_number'] = track_data['track_number']
        #doc.content = track_data['content'] || ""
        doc
      end      
    end
  end
  