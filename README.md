# wallace-thrasher
codename for a secret website project involving the works of a man named artie yamamoto

you can call me stretchie

this project uses whisper to have it output subtitle files, which can then be transformed into json files.
this website is built with the static site generator '[jekyll](https://jekyllrb.com)'

### Converting Tracks to Subtitles

i am using whisper-webui (deployed via pinokio) to analyze the .mp3 files using speech-to-text with speaker diarization to output subtitle files (.srt)

### Converting Subtitles to JSON

i am using [this python tool](https://github.com/willjasen/srt-to-json) to convert the subtitle files to json, but it also outputs a metadata.json file and a metadata.yml file in accordance to what this project needs

### To-Do's

the to-do list has been moved to [TODO.md](TODO.md)

### Licensing

This project is licensed under the [GPLv3](https://www.gnu.org/licenses/gpl-3.0.txt), and this license applies to all past versions and branches of the project.
