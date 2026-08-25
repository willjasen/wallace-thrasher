require 'json'

module Jekyll
  class TrackPagesGenerator < Generator
    safe true
    priority :low

    def generate(site)
      indexable = if ENV.key?('INDEXABLE')
                    ENV['INDEXABLE'] == 'true'
                  else
                    Jekyll.env == 'production' || Jekyll.env == 'indexable'
                  end
      site.config['indexable'] = indexable
      return unless indexable

      data_path = File.join(site.source, 'assets', 'json', 'data.combined.json')
      return unless File.exist?(data_path)

      albums = JSON.parse(File.read(data_path)).fetch('Albums', [])
      data_timestamp = Jekyll.git_timestamp(site.source, data_path) || File.mtime(data_path)
      albums.each do |album_data|
        album_slug = album_data['Album_Slug'] || Jekyll::Utils.slugify(album_data['Album'])
        album_data.fetch('Tracks', []).each do |track_data|
          site.collections['tracks'].docs << create_track_doc(site, album_data, album_slug, track_data, data_timestamp)
        end
      end
    end

    private

    def create_track_doc(site, album_data, album_slug, track_data, data_timestamp)
      track_slug = track_data['Track_Slug'] || Jekyll::Utils.slugify(track_data['Track_Title'])
      filename = "#{album_slug}-#{track_slug}.md"
      path = File.join(site.source, '_tracks', filename)
      subtitles = track_data.fetch('Subtitles', [])
      summary = subtitle_summary(subtitles)
      title = "#{track_data['Track_Title']} - #{album_data['Album']}"

      doc = Document.new(path, { :site => site, :collection => site.collections['tracks'] })
      doc.data['album_title'] = album_data['Album']
      doc.data['album_year'] = album_data['Year']
      doc.data['album_slug'] = album_slug
      doc.data['track_title'] = track_data['Track_Title']
      doc.data['track_number'] = track_data['Track_Number']
      doc.data['track_slug'] = track_slug
      doc.data['track_length'] = track_data['Track_Length']
      doc.data['track_subtitles'] = subtitles
      # Generated track documents do not have a checked-in source file of
      # their own. Use the track record's update timestamp for sitemap
      # lastmod instead of leaving the generated document undated.
      if track_data['Last_Modified']
        doc.data['last_modified_at'] = Time.at(track_data['Last_Modified'].to_i)
      else
        # A few legacy records predate per-track timestamps; keep those URLs
        # dated with the combined catalog's revision rather than omitting
        # lastmod entirely.
        doc.data['last_modified_at'] = data_timestamp
      end
      # Keep the complete combined record available to Liquid so the layout can
      # render the same data that powers the client-side search index.
      doc.data['track_data'] = track_data
      doc.data['title'] = title
      doc.data['description'] = summary.empty? ? "Subtitles, speaker notes, and track details for #{title}." : summary
      doc.data['image'] = "/assets/img/albums/#{album_data['Album_Picture']}"
      doc.data['permalink'] = "/tracks/#{album_slug}/#{track_slug}/"
      doc
    end

    def subtitle_summary(subtitles)
      subtitles
        .first(3)
        .map { |subtitle| subtitle['Text'].to_s.strip }
        .reject(&:empty?)
        .join(' ')
        .slice(0, 155)
        .to_s
    end
  end
end
