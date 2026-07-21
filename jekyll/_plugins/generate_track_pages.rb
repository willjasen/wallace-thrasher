require 'json'

module Jekyll
  class TrackPagesGenerator < Generator
    safe true
    priority :low

    def generate(site)
      data_path = File.join(site.source, 'assets', 'json', 'data.json')
      return unless File.exist?(data_path)

      albums = JSON.parse(File.read(data_path)).fetch('Albums', [])
      albums.each do |album_data|
        album_slug = album_data['Album_Slug'] || Jekyll::Utils.slugify(album_data['Album'])
        album_data.fetch('Tracks', []).each do |track_data|
          site.collections['tracks'].docs << create_track_doc(site, album_data, album_slug, track_data)
        end
      end
    end

    private

    def create_track_doc(site, album_data, album_slug, track_data)
      track_slug = track_data['Track_Slug'] || Jekyll::Utils.slugify(track_data['Track_Title'])
      filename = "#{album_slug}-#{track_slug}.md"
      path = File.join(site.source, '_tracks', filename)
      subtitles = load_subtitles(site, album_slug, track_data['Track_JSONPath'])
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
      doc.data['title'] = title
      doc.data['description'] = summary.empty? ? "Subtitles, speaker notes, and track details for #{title}." : summary
      doc.data['image'] = "/assets/img/albums/#{album_data['Album_Picture']}"
      doc.data['permalink'] = "/tracks/#{album_slug}/#{track_slug}/"
      doc
    end

    def load_subtitles(site, album_slug, json_path)
      return [] if json_path.nil? || json_path.empty?

      path = File.join(site.source, 'assets', 'json', album_slug, json_path)
      return [] unless File.exist?(path)

      JSON.parse(File.read(path))
    rescue JSON::ParserError => e
      Jekyll.logger.warn 'TrackPagesGenerator:', "Could not parse #{path}: #{e.message}"
      []
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
