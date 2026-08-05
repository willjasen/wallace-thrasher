require 'json'

module Jekyll
  class ValidateUsbTrackNames < Generator
    safe true
    priority :highest

    def generate(site)
      return if ENV['NETLIFY'].to_s.downcase == 'true'

      usb_root = ENV['LPC_USB_ROOT'].to_s.strip
      if usb_root.empty? || !Dir.exist?(usb_root)
        puts "\e[90mSkipping LPC USB track-name validation (set LPC_USB_ROOT to enable it).\e[0m"
        return
      end

      data_path = File.join(site.source, 'assets', 'json', 'data.json')
      albums = JSON.parse(File.read(data_path)).fetch('Albums', [])
      errors = []

      albums.each do |album|
        album_directory = album.fetch('USB_Directory', '').to_s
        album_path = File.join(usb_root, album_directory)
        unless Dir.exist?(album_path)
          errors << "missing album directory: #{album_directory}"
          next
        end

        album.fetch('Tracks', []).each do |track|
          filename = track.fetch('USB_Filename', '').to_s
          track_path = File.join(album_path, filename)
          next if File.file?(track_path)

          errors << "#{album_directory}/#{filename} (catalog title: #{track.fetch('Track_Title', '')})"
        end
      end

      if errors.empty?
        puts "\e[32mLPC USB track-name validation passed.\e[0m"
      else
        message = [
          'LPC USB track-name validation failed:',
          *errors.map { |error| "  - #{error}" },
          'Update data.json or the LPC USB files, or unset LPC_USB_ROOT to skip local validation.'
        ].join("\n")
        raise Jekyll::Errors::FatalException, message
      end
    end
  end
end
