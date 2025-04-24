require 'digest'
require 'json'

module Jekyll
  class GenerateJsonHashes < Generator
    safe true
    priority :low

    def generate(site)
        start_time = Time.now
        json_dir = File.join(site.source, 'assets', 'json')
        hash_file_path = File.join(json_dir, 'tracks.sha256')
        data_file_path = File.join(json_dir, 'data.json')

        # Read in the existing hashes from the .sha256 file or generate it if not found
        stored_hashes = {}
        if File.exist?(hash_file_path)
            File.readlines(hash_file_path).each do |line|
            hash, file = line.strip.split('  ', 2)
            stored_hashes[file] = hash
            end
        else
            puts "\e[33mHash file not found. Generating a new one...\e[0m"
            Dir.glob(File.join(json_dir, '**/*.json')) do |file|
                next if file.end_with?('data.json') # Exclude files 'data.json' and 'combined_data.json'

                file_content = File.read(file)
                file_hash = Digest::SHA256.hexdigest(file_content)
                relative_path = file.sub(json_dir + '/', '') # Include album folder in the path in the .sha256 file
                stored_hashes[relative_path] = file_hash
            end

            # Write the current hashes to a newly created .sha256 file
            File.open(hash_file_path, 'w') do |hash_file|
                stored_hashes.each do |file, hash|
                    hash_file.puts("#{hash}  #{file}")
                end
            end
            puts "\e[32mNew hash file created at '#{hash_file_path}'\e[0m"
            puts "generate_json_hashes.rb plugin took #{Time.now - start_time} seconds."
            return
        end

        # Read all of the current track JSON files and calculate their hashes
        current_hashes = []
        updated_files = []
        Dir.glob(File.join(json_dir, '**/*.json')) do |file|
            next if File.basename(file) == 'tracks.sha256' # Skip the hash file itself
            next if file.end_with?('data.json') # Exclude files ending with 'data.json'

            file_content = File.read(file)
            file_content = sanitize_json(file_content) # Sanitize JSON content
            file_hash = Digest::SHA256.hexdigest(file_content)
            relative_path = file.sub(json_dir + '/', '') # Include album folder in the path in the .sha256 file
            # puts "Processing file: #{relative_path}, Computed hash: #{file_hash}, Previous hash: #{stored_hashes[relative_path]}" # Log file details
            current_hashes << "#{file_hash}  #{relative_path}"

            if stored_hashes[relative_path] != file_hash
                updated_files << relative_path
            end
        end


        if updated_files.empty?
            puts "\e[32mNo track JSON file hashes have changed.\e[0m"

        elsif File.exist?(data_file_path)
            # Update the .sha256 file with newly found track hashes
            updated_hashes = File.readlines(hash_file_path).map do |line|
                old_hash, file = line.strip.split('  ', 2)
                if updated_files.include?(file)
                    new_hash = current_hashes.find { |h| h.include?(file) }.split('  ', 2).first
                    puts "\e[33mUpdating hash for file: #{file}, Old hash: #{old_hash}, New hash: #{new_hash}\e[0m"
                    "#{new_hash}  #{file}"
                    
                else
                    line.strip
                end
            end
            File.open(hash_file_path, 'w') do |hash_file|
                hash_file.puts(updated_hashes)
        end

        data_json = JSON.parse(sanitize_json(File.read(data_file_path)))

        puts "\e[33mThe following files have changed:\e[0m"
        updated_files.each do |updated_file_path|
            puts "\e[33m#{updated_file_path}\e[0m"
            data_json['Albums'].each do |album|
                # puts "\e[33mChecking album: #{album['Album']}\e[0m"
                album['Tracks'].each do |track|
                    # puts "\e[33mChecking track: #{track['Track_Title']}\e[0m"
                    # puts updated_file
                    updated_file = updated_file_path.split('/', 2).last
                    # puts updated_file
                    if track['Track_JSONPath'].split('/', 2).last == updated_file
                        puts "\e[33mUpdating Last_Modified for track: #{track['Track_Title']}\e[0m"
                        track['Last_Modified'] = Time.now.to_i
                    end
                end
            end
        end

        File.open(data_file_path, 'w') do |data_file|
            data_file.write(JSON.pretty_generate(data_json))
        end
        # puts "Updated Last_Modified for changed tracks in #{data_file_path}"

        else
            puts "\e[31mWarning: data.json file not found.\e[0m"
        end

        puts "generate_json_hashes.rb plugin took #{Time.now - start_time} seconds."
    end

    private

    def sanitize_json(json_content)
        json_content.encode('UTF-8', invalid: :replace, undef: :replace, replace: '')
    end
  end
end