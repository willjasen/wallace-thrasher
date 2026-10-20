# frozen_string_literal: true

require "fileutils"
require "digest"
require "json"
require "open3"
require "tmpdir"

module DocfindSearchExporter
  DOCFIND_ASSET_DIR = "assets/docfind"

  def self.tokens(text)
    text.to_s.split(/\s+/).filter_map do |word|
      token = word.gsub(/\A[^\p{Alnum}]+|[^\p{Alnum}]+\z/u, "").downcase
      token unless token.empty?
    end.uniq
  end

  def self.subtitle_documents(albums)
    documents = []

    albums.each do |album|
      (album["Tracks"] || []).each do |track|
        (track["Subtitles"] || []).each do |subtitle|
          documents << {
            "title" => "",
            "category" => "",
            "href" => "subtitle-#{documents.length}",
            "body" => "",
            "keywords" => tokens(subtitle["Text"])
          }
        end
      end
    end

    documents
  end

  def self.speaker_documents(albums)
    documents = []
    seen = {}

    albums.each do |album|
      (album["Tracks"] || []).each do |track|
        (track["Subtitles"] || []).each do |subtitle|
          speaker = subtitle["Speaker"].to_s.strip
          next if speaker.empty?

          key = [album["Album"], track["Track_Title"], speaker]
          next if seen[key]

          seen[key] = true
          documents << {
            "title" => speaker,
            "category" => "",
            "href" => "speaker-#{documents.length}",
            "body" => "",
            "keywords" => tokens(speaker)
          }
        end
      end
    end

    documents
  end

  def self.run_indexer(binary, documents, output_dir, kind)
    input_path = File.join(File.dirname(output_dir), "#{kind}.json")
    File.write(input_path, JSON.generate(documents))

    stdout, stderr, status = Open3.capture3(binary, input_path, output_dir)
    return if status.success?

    raise Jekyll::Errors::FatalException,
          "docfind failed to build the #{kind} search index:\n#{stdout}#{stderr}"
  end

  def self.resolve_binary
    configured = ENV["DOCFIND_BIN"]
    if configured
      return configured if File.executable?(configured)

      raise Jekyll::Errors::FatalException,
            "DOCFIND_BIN is set to a missing or non-executable file: #{configured}"
    end

    return "docfind" if ENV.fetch("PATH", "").split(File::PATH_SEPARATOR).any? do |directory|
      File.executable?(File.join(directory, "docfind"))
    end

    raise Jekyll::Errors::FatalException,
          "docfind CLI was not found. Run `sh scripts/install-docfind.sh` from jekyll/ " \
          "and set DOCFIND_BIN to the installed executable."
  end

  def self.data_path(site)
    File.join(site.source, "assets", "json", "data.combined.json")
  end

  def self.prepare(site)
    site.config["docfind_search_version"] = Digest::SHA256.file(data_path(site)).hexdigest[0, 16]
  end

  def self.generate(site)
    albums = JSON.parse(File.read(data_path(site))).fetch("Albums")
    binary = resolve_binary
    destination = File.join(site.dest, DOCFIND_ASSET_DIR, site.config.fetch("docfind_search_version"))

    Dir.mktmpdir("docfind-search") do |temporary_dir|
      [
        ["subtitles", subtitle_documents(albums)],
        ["speakers", speaker_documents(albums)]
      ].each do |kind, documents|
        output_dir = File.join(temporary_dir, kind)
        FileUtils.mkdir_p(output_dir)
        run_indexer(binary, documents, output_dir, kind)

        %w[docfind.js docfind_bg.wasm].each do |filename|
          output_path = File.join(output_dir, filename)
          unless File.file?(output_path)
            raise Jekyll::Errors::FatalException,
                  "docfind did not generate #{filename} for the #{kind} index."
          end
        end

        target_dir = File.join(destination, kind)
        FileUtils.mkdir_p(target_dir)
        FileUtils.cp(File.join(output_dir, "docfind.js"), target_dir)
        FileUtils.cp(File.join(output_dir, "docfind_bg.wasm"), target_dir)
        Jekyll.logger.info("docfind:", "Built #{kind} index from #{documents.length} documents.")
      end
    end
  end
end

Jekyll::Hooks.register :site, :pre_render do |site|
  DocfindSearchExporter.prepare(site)
end

Jekyll::Hooks.register :site, :post_write do |site|
  DocfindSearchExporter.generate(site)
end
