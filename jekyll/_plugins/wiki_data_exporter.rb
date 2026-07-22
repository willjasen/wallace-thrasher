# frozen_string_literal: true

require "fileutils"
require "json"
require "pathname"
require "time"

module WikiDataExporter
  DATA_ROOT = File.expand_path("../../python/wiki-data", __dir__)
  CATALOG_PATH = File.expand_path("../assets/json/data.json", __dir__)
  PUBLIC_ROOT = "assets/wiki-data"
  EXPORTED_DIRECTORIES = %w[comparisons scrapes].freeze

  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      unless Dir.exist?(DATA_ROOT)
        Jekyll.logger.warn("Wiki data:", "#{DATA_ROOT} was not found; skipping explorer data.")
        return
      end

      manifest = build_manifest
      page = Jekyll::PageWithoutAFile.new(site, site.source, PUBLIC_ROOT, "manifest.json")
      page.content = JSON.generate(manifest)
      page.data["layout"] = nil
      page.data["sitemap"] = false
      site.pages << page
    end

    private

    def build_manifest
      latest = read_latest
      runs = {}

      directory_names("scrapes").each do |run_id|
        run = runs[run_id] ||= base_run(run_id, latest)
        add_scrapes(run)
      end

      directory_names("comparisons").each do |run_id|
        run = runs[run_id] ||= base_run(run_id, latest)
        run["has_comparisons"] = true
        add_comparisons(run)
      end

      runs.each_value { |run| finalize_run(run) }
      run_list = runs.values.sort_by { |run| [-run["timestamp_ms"], run["id"]] }
      comparison_tracks = run_list.sum { |run| run["track_count"] }
      scrape_records = run_list.sum { |run| run["scrape_track_count"] }
      wiki_pages_found = run_list.sum { |run| run["scrape_found_count"] }
      wiki_pages_missing = run_list.sum { |run| run["scrape_missing_count"] }
      merge_runs = build_merge_runs

      {
        "format_version" => 2,
        "latest_scrape" => latest,
        "stats" => {
          "scrape_runs" => directory_names("scrapes").length,
          "scrape_records" => scrape_records,
          "wiki_pages_found" => wiki_pages_found,
          "wiki_pages_missing" => wiki_pages_missing,
          "comparison_runs" => directory_names("comparisons").length,
          "merge_backup_runs" => directory_names("merge-backups").length,
          "merge_backup_files" => merge_runs.sum { |run| run["file_count"] },
          "comparison_tracks" => comparison_tracks
        },
        "runs" => run_list,
        "merge_runs" => merge_runs
      }
    end

    def read_latest
      path = File.join(DATA_ROOT, "latest-scrape")
      File.file?(path) ? File.read(path, encoding: "UTF-8").strip : nil
    end

    def directory_names(name)
      root = File.join(DATA_ROOT, name)
      return [] unless Dir.exist?(root)

      Dir.children(root).select { |entry| File.directory?(File.join(root, entry)) }.sort
    end

    def base_run(run_id, latest)
      timestamp_ms = run_id[/\A\d{13}/].to_i
      label = run_id.sub(/\A\d{13}-?/, "")
      {
        "id" => run_id,
        "label" => label.empty? ? "unlabeled run" : label,
        "timestamp_ms" => timestamp_ms,
        "created_at" => Time.at(timestamp_ms / 1000.0).utc.iso8601(3),
        "latest" => run_id == latest,
        "has_scrape" => false,
        "has_comparisons" => false,
        "track_count" => 0,
        "scrape_track_count" => 0,
        "scrape_found_count" => 0,
        "scrape_missing_count" => 0,
        "albums" => []
      }
    end

    def add_scrapes(run)
      run["has_scrape"] = true
      run_root = File.join(DATA_ROOT, "scrapes", run["id"])

      Dir.glob(File.join(run_root, "**", "*.json")).sort.each do |path|
        scrape = JSON.parse(File.read(path, encoding: "UTF-8"))
        album_slug = scrape.fetch("album_slug", "unknown-album")
        track_slug = scrape.fetch("track_slug", File.basename(path, ".json"))
        album = album_record(run, album_slug, catalog_album_title(album_slug))
        track = track_record(album, track_slug, scrape.fetch("track_title", catalog_track_title(album_slug, track_slug)))
        relative_path = Pathname.new(path).relative_path_from(Pathname.new(DATA_ROOT)).to_s
        transcript = scrape["transcript"].is_a?(Array) ? scrape["transcript"] : []

        track.merge!(
          "wiki_title" => scrape["wiki_title"],
          "wiki_url" => scrape["wiki_url"],
          "wiki_pageid" => scrape["wiki_pageid"],
          "not_found" => scrape["not_found"] == true,
          "transcript_lines" => transcript.length,
          "scrape_path" => "/#{PUBLIC_ROOT}/#{relative_path}"
        )
      end
    end

    def add_comparisons(run)
      run["has_comparisons"] = true
      run_root = File.join(DATA_ROOT, "comparisons", run["id"])

      Dir.glob(File.join(run_root, "**", "*.json")).sort.each do |path|
        comparison = JSON.parse(File.read(path, encoding: "UTF-8"))
        album_slug = comparison.fetch("album_slug", "unknown-album")
        track_slug = comparison.fetch("track_slug", File.basename(path, ".json"))
        album = album_record(run, album_slug, comparison.fetch("album", catalog_album_title(album_slug)))
        album["title"] = comparison["album"] if comparison["album"]
        track = track_record(album, track_slug, comparison.fetch("track", catalog_track_title(album_slug, track_slug)))

        relative_path = Pathname.new(path).relative_path_from(Pathname.new(DATA_ROOT)).to_s
        scrape_path = File.join(DATA_ROOT, "scrapes", run["id"], album_slug, "#{track_slug}.json")
        track.merge!(
          "title" => comparison.fetch("track", track["title"]),
          "wiki_title" => comparison["wiki_title"],
          "wiki_url" => comparison["wiki_url"] || track["wiki_url"],
          "generated_at" => comparison["generated_at"],
          "summary" => comparison.fetch("summary", {}),
          "comparison_path" => "/#{PUBLIC_ROOT}/#{relative_path}",
          "scrape_path" => track["scrape_path"] || (File.file?(scrape_path) ? "/#{PUBLIC_ROOT}/scrapes/#{run["id"]}/#{album_slug}/#{track_slug}.json" : nil)
        )
      end
    end

    def finalize_run(run)
      run["albums"].sort_by! { |album| album["title"].downcase }
      run["albums"].each { |album| album["tracks"].sort_by! { |track| track["title"].downcase } }
      tracks = run["albums"].flat_map { |album| album["tracks"] }
      scrape_tracks = tracks.select { |track| track["scrape_path"] }
      run["track_count"] = tracks.count { |track| track["comparison_path"] }
      run["scrape_track_count"] = scrape_tracks.length
      run["scrape_found_count"] = scrape_tracks.count { |track| track["wiki_title"] && !track["not_found"] }
      run["scrape_missing_count"] = scrape_tracks.count { |track| track["not_found"] || !track["wiki_title"] }
    end

    def album_record(run, slug, title)
      run["albums"].find { |album| album["slug"] == slug } || begin
        album = { "slug" => slug, "title" => title, "tracks" => [] }
        run["albums"] << album
        album
      end
    end

    def track_record(album, slug, title)
      album["tracks"].find { |track| track["slug"] == slug } || begin
        track = { "slug" => slug, "title" => title }
        album["tracks"] << track
        track
      end
    end

    def build_merge_runs
      directory_names("merge-backups").map do |run_id|
        root = File.join(DATA_ROOT, "merge-backups", run_id)
        files = Dir.glob(File.join(root, "**", "*.json"))
        album_counts = files.each_with_object(Hash.new(0)) do |path, counts|
          relative = Pathname.new(path).relative_path_from(Pathname.new(root))
          counts[relative.each_filename.first] += 1
        end
        timestamp_ms = run_id[/\A\d{13}/].to_i
        {
          "id" => run_id,
          "label" => run_id.sub(/\A\d{13}-?/, "").then { |label| label.empty? ? "unlabeled merge" : label },
          "timestamp_ms" => timestamp_ms,
          "created_at" => Time.at(timestamp_ms / 1000.0).utc.iso8601(3),
          "file_count" => files.length,
          "album_count" => album_counts.length,
          "albums" => album_counts.sort.map { |slug, count| { "slug" => slug, "title" => catalog_album_title(slug), "file_count" => count } }
        }
      end.sort_by { |run| [-run["timestamp_ms"], run["id"]] }
    end

    def catalog
      @catalog ||= if File.file?(CATALOG_PATH)
        JSON.parse(File.read(CATALOG_PATH, encoding: "UTF-8"))
      else
        { "Albums" => [] }
      end
    end

    def catalog_album(album_slug)
      catalog.fetch("Albums", []).find { |album| album["Album_Slug"] == album_slug }
    end

    def catalog_album_title(album_slug)
      catalog_album(album_slug)&.fetch("Album", nil) || album_slug.split("-").map(&:capitalize).join(" ")
    end

    def catalog_track_title(album_slug, track_slug)
      album = catalog_album(album_slug)
      track = album&.fetch("Tracks", [])&.find { |item| item["Track_Slug"] == track_slug }
      track&.fetch("Track_Title", nil) || track_slug.split("-").map(&:capitalize).join(" ")
    end
  end

  Jekyll::Hooks.register :site, :post_write do |site|
    next unless Dir.exist?(DATA_ROOT)

    destination_root = File.join(site.dest, PUBLIC_ROOT)
    FileUtils.mkdir_p(destination_root)

    EXPORTED_DIRECTORIES.each do |name|
      source = File.join(DATA_ROOT, name)
      next unless Dir.exist?(source)

      destination = File.join(destination_root, name)
      expanded_destination = File.expand_path(destination)
      expanded_site_destination = File.expand_path(site.dest) + File::SEPARATOR
      next unless expanded_destination.start_with?(expanded_site_destination)

      FileUtils.rm_rf(destination)
      FileUtils.cp_r(source, destination)
    end
  end
end
