# frozen_string_literal: true

require "fileutils"
require "json"
require "pathname"

module TranscriptionDataExporter
  DATA_ROOT = File.expand_path("../../analysis/whisper-webui", __dir__)
  PUBLIC_ROOT = "assets/transcription-data"

  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      manifest = build_manifest
      page = Jekyll::PageWithoutAFile.new(site, site.source, PUBLIC_ROOT, "manifest.json")
      page.content = JSON.generate(manifest)
      page.data["layout"] = nil
      page.data["sitemap"] = false
      site.pages << page
    end

    private

    def build_manifest
      runs = comparison_paths.map do |path|
        comparison = read_json(path)
        manifest = read_json(path.sub(/comparison\.json\z/, "manifest.json"))
        relative = Pathname.new(path).relative_path_from(Pathname.new(DATA_ROOT)).to_s
        run_id = File.dirname(relative)
        receipts = Dir.glob(File.join(File.dirname(path), "merge-receipts", "*.json")).sort
        target = comparison.fetch("target", {})
        track = manifest.fetch("track", {})
        {
          "id" => run_id,
          "album" => target["album"] || track["album"],
          "album_slug" => target["album_slug"] || track["album_slug"],
          "track" => target["track"] || track["track"],
          "track_slug" => target["track_slug"] || track["track_slug"],
          "generated_at" => comparison["generated_at"],
          "analysis_created_at" => manifest["created_at"],
          "model" => comparison.dig("source", "model") || manifest.dig("request", "model"),
          "alignment_count" => comparison.fetch("alignments", []).length,
          "review_lines" => comparison.fetch("alignments", []).count { |line| line["text_action"] == "review" || line["speaker_action"] == "review" },
          "approved_lines" => comparison.fetch("alignments", []).count { |line| line["text_action"] == "approved" || line["speaker_action"] == "approved" },
          "speaker_mappings" => comparison.fetch("speaker_mappings", []).length,
          "metadata_proposals" => %w[aliases establishments].sum { |key| comparison.dig("metadata", key)&.length.to_i },
          "merged" => !receipts.empty?,
          "merge_count" => receipts.length,
          "comparison_path" => "/#{PUBLIC_ROOT}/#{relative}",
          "receipt_paths" => receipts.map { |receipt| "/#{PUBLIC_ROOT}/#{Pathname.new(receipt).relative_path_from(Pathname.new(DATA_ROOT)).to_s}" }
        }
      end
      runs.sort_by { |run| [run["generated_at"].to_s, run["id"]] }.reverse
      {
        "format_version" => 1,
        "stats" => {
          "comparison_runs" => runs.length,
          "tracks" => runs.map { |run| [run["album_slug"], run["track_slug"]] }.uniq.length,
          "review_lines" => runs.sum { |run| run["review_lines"] },
          "approved_lines" => runs.sum { |run| run["approved_lines"] },
          "merge_receipts" => runs.sum { |run| run["merge_count"] },
          "merged_runs" => runs.count { |run| run["merged"] }
        },
        "runs" => runs
      }
    end

    def comparison_paths
      return [] unless Dir.exist?(DATA_ROOT)

      Dir.glob(File.join(DATA_ROOT, "*", "*", "*", "comparison.json")).sort
    end

    def read_json(path)
      JSON.parse(File.read(path, encoding: "UTF-8"))
    rescue Errno::ENOENT, JSON::ParserError
      {}
    end
  end

  Jekyll::Hooks.register :site, :post_write do |site|
    next unless Dir.exist?(DATA_ROOT)

    destination_root = File.expand_path(File.join(site.dest, PUBLIC_ROOT))
    FileUtils.mkdir_p(destination_root)
    comparison_paths = Dir.glob(File.join(DATA_ROOT, "*", "*", "*", "comparison.json"))
    source_paths = comparison_paths + comparison_paths.flat_map { |path| Dir.glob(File.join(File.dirname(path), "merge-receipts", "*.json")) }
    source_paths.each do |source|
      relative = Pathname.new(source).relative_path_from(Pathname.new(DATA_ROOT)).to_s
      destination = File.expand_path(File.join(destination_root, relative))
      next unless destination.start_with?(destination_root + File::SEPARATOR)

      FileUtils.mkdir_p(File.dirname(destination))
      FileUtils.cp(source, destination)
    end
  end
end
