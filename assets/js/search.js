/*
---
layout: null
---
*/

// search.js

// Define the base URL
const BASE_URL = "/wallace-thrasher";

/*
    This function retrieves a JSON document from a given path
*/
async function fetchData(path) {
    try {
        const response = await fetch(path);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

/*
    This function loads the JSON data and creates a data structure
*/
async function loadData() {

    var loadIndividualTrackJSON = '{{ site.data.loadIndividualTrackJSON }}';
    var jekyll_env = '{{ jekyll.environment }}';
    let dataStructure = [];
    
    if (loadIndividualTrackJSON === true) {
        console.log("Loading data from individual JSON files...");
        const data = await fetchData(`${BASE_URL}/assets/json/data.json`);

        // Iterate through each album, track, and subtitle
        for (const albumsKey of Object.keys(data)) {
            const albums = data[albumsKey];
            for(const album of albums) {
                console.log("Loading album: " + album.Album);
                for (const track of album.Tracks) {
                    const jsonPath = `${BASE_URL}/assets/json/`+album.Album_Slug+"/"+track.Track_JSONPath;
                    trackSubtitlesData = await fetchData(jsonPath);
                    for (const subtitle of trackSubtitlesData) {
                        dataStructure.push({
                            id: `${album.Album}-${track.Track_Title}-${subtitle.Index}`, // create a unique ID for each subtitle using album, track title, and subtitle index
                            Album: album.Album,
                            Album_Year: album.Year,
                            Album_Picture: album.Album_Picture,
                            Album_Slug: album.Album_Slug,
                            Track_Number: track.Track_Number,
                            Track_Slug: track.Track_Slug,
                            Track_Subtitles: track.Subtitles,
                            Track_Title: track.Track_Title,
                            Speaker: subtitle.Speaker,
                            Text: subtitle.Text,
                            StartTime: subtitle["Start Time"],
                            EndTime: subtitle["End Time"],
                            Whisper_Model: track.Whisper_Model
                        });
                    }
                }
            }
            console.log("All albums have been loaded.");
        }

    } else {
        console.log("Using combined_data.json");
        console.log(loadIndividualTrackJSON);
        const data = await fetchData(`${BASE_URL}/assets/json/combined_data.json`);

        // Iterate through each album, track, and subtitle
        for (const albumsKey of Object.keys(data)) {
            const albums = data[albumsKey];
            
            for(const album of albums) {
                console.log("Loading album: " + album.Album);
                for (const track of album.Tracks) {
                    // const jsonPath = "/assets/json/"+album.Album_Slug+"/"+track.Track_JSONPath;
                    // trackSubtitlesData = await fetchData(jsonPath);
                    for (const subtitle of track.Subtitles) {
                        dataStructure.push({
                            id: `${album.Album}-${track.Track_Title}-${subtitle.Index}`, // create a unique ID for each subtitle using album, track title, and subtitle index
                            Album: album.Album,
                            Album_Year: album.Year,
                            Album_Picture: album.Album_Picture,
                            Album_Slug: album.Album_Slug,
                            Track_Number: track.Track_Number,
                            Track_Slug: track.Track_Slug,
                            Track_Subtitles: track.Subtitles,
                            Track_Title: track.Track_Title,
                            Speaker: subtitle.Speaker,
                            Text: subtitle.Text,
                            StartTime: subtitle["Start Time"],
                            EndTime: subtitle["End Time"],
                            Whisper_Model: track.Whisper_Model
                        });
                    }
                }
            }
            console.log("All albums have been loaded.");
        }
    }

    return dataStructure;
}

/*
    This is the main function that loads in the JSON data, creates a data structure, and indexes the data for search
*/
async function main(callback) {
    try {
        var jekyll_env = '{{ jekyll.environment }}';
        dataStructure = await loadData();
       
        // Function to index a search based on a field
        function indexOnField(indexField) {
            let startTimeInMilliseconds = Date.now();
            const idx = lunr(function () {
                this.ref('id');
                this.field(indexField);

                dataStructure.forEach(function (doc) {
                    this.add(doc);
                }, this);
            });
            let endTimeInMilliseconds = Date.now();
            console.log("Indexing " + indexField + " took " + (endTimeInMilliseconds - startTimeInMilliseconds) + " milliseconds.");
            return idx;
        };

        // Create the search indexes
        const idxText = indexOnField('Text');
        const idxSpeaker = indexOnField('Speaker');

        

        // Get number of times Alex Trebek shows up
        const resultsForAlexTrebek = idxSpeaker.search("Alex");
        let tracksWithAlexTrebek = new Set();
        resultsForAlexTrebek.forEach(function (resultForAlex) {
            const matchedDoc = dataStructure.find(doc => doc.id === resultForAlex.ref);
                //if (matchedDoc && matchedDoc.Speaker.includes(query)) {
                const key = createKey(matchedDoc.Album, matchedDoc.Track_Title, matchedDoc.Speaker);
                
                // Add to Set only if the combination isn't already added
                if (!tracksWithAlexTrebek.has(key)) {
                    tracksWithAlexTrebek.add(key);
                }
        });
        const countOfAlexTrebek = tracksWithAlexTrebek.size;
        console.log("Alex Trebek is found " + countOfAlexTrebek + " times.");



        // Set up the subtitles search input listener
        if (document.querySelector('#subtitles-search-input')) {
            fileMap = {};
            if(jekyll_env != "production") {
                const fileInput = document.getElementById('fileInput');
                const audio = document.getElementById('audioPlayer');
                fileInput.addEventListener('change', function(event) {
                    fileTarget = event.target;
                    const files = fileTarget.files;
                    for (const file of files) {
                        if (file.name.endsWith('.mp3')) {
                            const url = URL.createObjectURL(file);
                            fileMap[file.webkitRelativePath] = url;
                        }  
                    }
                    console.log("Files have been uploaded! Jumping to a subtitle will now work!");

                    // Update the input of #subtitles-search-input
                    const subtitlesSearchInput = document.querySelector('#subtitles-search-input');
                    if (subtitlesSearchInput) {
                        subtitlesSearchInput.value = subtitlesSearchInput.value; // Set the value to itself
                        subtitlesSearchInput.dispatchEvent(new Event('input')); // Trigger the input event
                    }
                });
            }
            document.querySelector('#subtitles-search-input').addEventListener('input', function () {
                if (this.value != "") {
                    const query = this.value;
                    const results = idxText.search(query);
                    //console.log("Search query:", query);
                    //console.log("Search results:", results);

                    // Clear previous results
                    const resultList = document.querySelector('#subtitles-search-results');
                    resultList.innerHTML = '';

                    // Display search results
                    let resultCount = 0;
                    results.forEach(function (result) {

                        resultCount++;
                        const matchedDoc = dataStructure.find(doc => doc.id === result.ref);

                        const albumAndTitleItem = document.createElement('li');
                        albumAndTitleItem.innerHTML = `
                            <img src="${BASE_URL}/assets/img/albums/${matchedDoc.Album_Picture}" alt="${matchedDoc.Album}" width="25" height="25">
                            <strong>${matchedDoc.Album}</strong> - 
                            <i><a href="${BASE_URL}/tracks/${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i>
                        `;

                        if (!fileMap || Object.keys(fileMap).length === 0) {
                            albumAndTitleItem.innerHTML += `
                                <small> @ ${matchedDoc.StartTime}</small>
                            `;
                        }
                        else {
                            albumAndTitleItem.innerHTML += `
                                <small> @ </small>
                            `;

                            // Create a clickable link
                            const matchedAlbumYear = matchedDoc.Album_Year;
                            const matchedAlbumTitle = matchedDoc.Album;
                            const trackTitleDetail = matchedDoc.Track_Title;

                            const startTimeLink = document.createElement('a');
                            startTimeLink.href = "#" + matchedDoc.StartTime;
                            startTimeLink.textContent = matchedDoc.StartTime;
                            
                            // Parse minutes and seconds. For format "HH:MM:SS,ms"
                            const timeParts = matchedDoc.StartTime.split(":");
                            const minutes = parseInt(timeParts[1], 10);
                            const seconds = parseInt(timeParts[2].split(",")[0], 10);
                            const secondsConverted = (minutes * 60) + seconds;
                            startTimeLink.addEventListener('click', function(e) {
                                const relevantUrl = `LPC USB/${matchedAlbumYear} - ${matchedAlbumTitle}/${trackTitleDetail}.mp3`;
                                // console.log('Relevant URL: ' + relevantUrl);
                                const matchingUrl = fileMap[relevantUrl];
                                // console.log('Matching URL: ' + matchingUrl);
                                e.preventDefault();
                                const audioPlayer = document.getElementById('audioPlayer');
                                if (audioPlayer) {
                                    audioPlayer.src = matchingUrl;
                                    audioPlayer.currentTime = secondsConverted;
                                    console.log(audioPlayer.src);
                                    console.log("Playing audio from timestamp:", secondsConverted);
                                    audioPlayer.play();
                                }
                            });
                            albumAndTitleItem.appendChild(startTimeLink);
                        }

                        const subtitleItem = document.createElement('ul'); // Create a new ul for indentation
                        const subtitleItemLi = document.createElement('li');
                        subtitleItemLi.innerHTML = `${matchedDoc.Speaker}: "${matchedDoc.Text}"`;
                        subtitleItem.appendChild(subtitleItemLi); // Append the subtitle item to the ul

                        albumAndTitleItem.appendChild(subtitleItem); // Append the ul to the albumAndTitleItem
                        resultList.appendChild(albumAndTitleItem); // Finally, append the albumAndTitleItem to the resultList
                    });
                    const totalCountContainer = document.createElement('div');
                    totalCountContainer.style.marginBottom = '25px';
                    totalCountContainer.innerHTML = `Subtitles found: ${resultCount}`;
                    resultList.insertBefore(totalCountContainer, resultList.firstChild);
                }
            });
        }

        // Set up the speakers search input listener
        if (document.querySelector('#speakers-search-input')) {
            document.querySelector('#speakers-search-input').addEventListener('input', function () {
                if (this.value.trim() !== "") {
                    const query = this.value.trim();
                    const results = idxSpeaker.search(query);
                    //console.log("Search query:", query);
                    //console.log("Search results:", results);

                    // Clear previous results
                    const resultList = document.querySelector('#speakers-search-results');
                    resultList.innerHTML = '';

                    // Set to store the unique track and speaker combinations
                    let tracksWithSpeaker = new Set();

                    // Display search results
                    results.forEach(function (result) {
                        const matchedDoc = dataStructure.find(doc => doc.id === result.ref);

                        //if (matchedDoc && matchedDoc.Speaker.includes(query)) {
                        const key = createKey(matchedDoc.Album, matchedDoc.Track_Title, matchedDoc.Speaker);

                        // Add to Set only if the combination isn't already added
                        if (!tracksWithSpeaker.has(key)) {
                            tracksWithSpeaker.add(key);

                            // Display the result
                            const albumAndTitleItem = document.createElement('li');
                            albumAndTitleItem.innerHTML = `
                                ${matchedDoc.Speaker} -- 
                                <i><a href="${BASE_URL}/tracks/${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i> --
                                ${matchedDoc.Album}
                            `;
                            resultList.appendChild(albumAndTitleItem);
                        }
                    });

                    // Display the count of unique track-speaker combinations
                    const trackCount = tracksWithSpeaker.size;
                    const totalCountContainer = document.createElement('div');
                    totalCountContainer.style.marginBottom = '25px';
                    totalCountContainer.innerHTML = `<br/><p>Unique track-speaker combinations: ${trackCount}</p>`;
                    resultList.insertBefore(totalCountContainer, resultList.firstChild);
                }
            });
        }

        function onDomContentLoaded() {
            console.log("Alex Trebek is found " + countOfAlexTrebek + " times!");
            const alexSpan = document.querySelector('#alex-count-span');
            if (alexSpan) {
                alexSpan.textContent = countOfAlexTrebek;
            } else {
                console.error('Element with id "alex-count-span" not found.');
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onDomContentLoaded);
        } else {
            // DOM already loaded, so run it now
            onDomContentLoaded();
        }

        // Function to create a unique key
        function createKey(albumTitle, trackTitle, speaker) {
            return `${albumTitle}-${trackTitle}-${speaker}`;
        }

        callback(true);

    } catch (error) {
        console.error('Error in main function:', error);
        callback(false);
    }
}

// Execute this program
var dataLoaded = false;
main(function(dataReady) {
    console.log("Document readyState:", document.readyState);
    if (dataReady) {
      dataLoaded = dataReady;
    }
  });
