module Jekyll
  # Populate sitemap dates from the source file's modification time.
  # Explicit front matter remains authoritative when provided.
  Jekyll::Hooks.register :site, :post_read do |site|
    documents = site.pages + site.collections.values.flat_map(&:docs)

    documents.each do |document|
      next if document.data['last_modified_at']
      next unless document.respond_to?(:path) && File.file?(document.path)

      document.data['last_modified_at'] = File.mtime(document.path)
    end
  end
end
