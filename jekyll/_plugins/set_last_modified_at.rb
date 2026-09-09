module Jekyll
  require 'open3'
  require 'time'

  # Populate sitemap dates from the source file's modification time.
  # Explicit front matter remains authoritative when provided. Git's latest
  # commit timestamp is preferred so deployment checkout times do not make
  # unchanged pages appear newly modified.
  Jekyll::Hooks.register :site, :post_read do |site|
    documents = site.pages + site.collections.values.flat_map(&:docs)

    documents.each do |document|
      next if document.data['last_modified_at']
      next unless document.respond_to?(:path) && File.file?(document.path)

      document.data['last_modified_at'] = Jekyll.git_timestamp(site.source, document.path) || File.mtime(document.path)
    end
  end

  def self.git_timestamp(site_source, path)
    relative_path = path.delete_prefix("#{site_source}/")
    output, status = Open3.capture2(
      'git', '-C', site_source, 'log', '-1', '--format=%cI', '--', relative_path
    )
    return unless status.success?

    timestamp = output.strip
    timestamp.empty? ? nil : Time.parse(timestamp)
  rescue Errno::ENOENT, ArgumentError
    nil
  end

  # Return the latest commit date for each JSON source in a single Git query.
  # Generated track and album pages use these dates so metadata stays current
  # after a GitHub merge without writing timestamps back into data.json.
  def self.track_git_timestamps(site_source)
    @track_git_timestamps ||= {}
    cache_key = File.expand_path(site_source)
    return @track_git_timestamps[cache_key] if @track_git_timestamps.key?(cache_key)

    output, status = Open3.capture2(
      'git', '-C', site_source, 'log', '--relative', '--format=__COMMIT__%cI', '--name-only', '--', 'assets/json'
    )
    timestamps = {}
    current_timestamp = nil

    if status.success?
      output.each_line do |line|
        entry = line.strip
        if entry.start_with?('__COMMIT__')
          current_timestamp = Time.parse(entry.delete_prefix('__COMMIT__'))
        elsif current_timestamp && entry.start_with?('assets/json/') && entry.end_with?('.json')
          timestamps[entry] ||= current_timestamp
        end
      end
    end

    @track_git_timestamps[cache_key] = timestamps
  rescue Errno::ENOENT, ArgumentError
    @track_git_timestamps[cache_key] = {}
  end

  def self.track_timestamp(site_source, album_slug, track_json_path)
    relative_path = File.join('assets', 'json', album_slug, track_json_path)
    track_git_timestamps(site_source)[relative_path] || begin
      full_path = File.join(site_source, relative_path)
      File.mtime(full_path) if File.file?(full_path)
    end
  end
end
