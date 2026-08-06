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
end
