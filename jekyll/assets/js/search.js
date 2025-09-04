---

---
// These 3 lines above must stay because they are used like front matter for Jekyll to process

// search.js
const BASE_URL = '{{ site.baseurl }}';
console.log("BASE_URL: " + (BASE_URL ? BASE_URL : "<null>"));
const loadIndividualTrackJSON = '{{ site.loadIndividualTrackJSON }}' === 'true';
console.log("loadIndividualTrackJSON: " + loadIndividualTrackJSON);

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

// Add a function to get URL parameters
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Generalize the URL parameter handling
function handleSearchParameter() {
    const searchParam = getUrlParameter('search');
    if (searchParam) {
        // Determine the input field based on the page context
        const subtitlesSearchInput = document.querySelector('#subtitles-search-input');
        const speakersSearchInput = document.querySelector('#speakers-search-input');

        if (subtitlesSearchInput) {
            subtitlesSearchInput.value = searchParam;
            subtitlesSearchInput.dispatchEvent(new Event('input'));
        } else if (speakersSearchInput) {
            speakersSearchInput.value = searchParam;
            speakersSearchInput.dispatchEvent(new Event('input'));
        }
    }
}

// Return the total number of tracks across all albums
function getTotalTracks(data) {
    return Object.values(data).reduce(
        (albumAcc, albums) =>
            albumAcc + albums.reduce((trackAcc, album) => trackAcc + album.Tracks.length, 0),
        0
    );
}

/*
    This function loads the JSON data and creates a data structure
*/
async function loadData() {

    let dataStructure = [];
    
    var jekyll_env = '{{ jekyll.environment }}';
    
    if (loadIndividualTrackJSON) {
        console.log("--Loading data from data.json and the individual track JSON files--");
        const data = await fetchData(BASE_URL+"/assets/json/data.json");

        // Calculate total number of tracks across all albums
        const totalTracks = getTotalTracks(data);
        console.log("Total tracks in data.json:", totalTracks);

        // Iterate through each album, track, and subtitle
        for (const albumsKey of Object.keys(data)) {
            const albums = data[albumsKey];
            const numberOfAlbums = albums.length;
            for(const album of albums) {
                console.log("Loading album: " + album.Album);
                let trackFetchPromises = [];
                let trackInfoList = [];
                for (const track of album.Tracks) {
                    const jsonPath = BASE_URL+"/assets/json/"+album.Album_Slug+"/"+track.Track_JSONPath;
                    trackFetchPromises.push(fetchData(jsonPath));
                    trackInfoList.push({ album, track });
                    // If we have 4 promises or it's the last track, process the batch
                    const maxBatchSize = 4;
                    if (trackFetchPromises.length === maxBatchSize || track === album.Tracks[album.Tracks.length - 1]) {
                        const results = await Promise.all(trackFetchPromises);
                        for (let i = 0; i < results.length; i++) {
                            const trackSubtitlesData = results[i];
                            const { album, track } = trackInfoList[i];
                            for (const subtitle of trackSubtitlesData) {
                                dataStructure.push({
                                    id: `${album.Album}-${track.Track_Title}-${subtitle.Index}`,
                                    Album: album.Album,
                                    Album_Year: album.Year,
                                    Album_Picture: album.Album_Picture,
                                    Album_Slug: album.Album_Slug,
                                    Track_Number: track.Track_Number,
                                    Track_Slug: track.Track_Slug,
                                    Track_Subtitles: track.Subtitles,
                                    Track_Title: track.Track_Title,
                                    Aliases: track.Aliases,
                                    Speaker: subtitle.Speaker,
                                    Text: subtitle.Text,
                                    StartTime: subtitle["Start Time"],
                                    EndTime: subtitle["End Time"],
                                    Whisper_Model: track.Whisper_Model
                                });
                            }
                            trackDataLoadedPercentage += (1 / totalTracks) * 100;
                        }
                        // Reset for next batch
                        trackFetchPromises = [];
                        trackInfoList = [];
                    }
                }
                albumDataLoadedPercentage += (1 / numberOfAlbums) * 100;
            }
            console.log("All albums have been loaded.");
        }

    } else {
        console.log("--Loading data from combined_data.json--");
        const data = await fetchData(BASE_URL+"/assets/json/combined_data.json");

        // Calculate total number of tracks across all albums
        const totalTracks = getTotalTracks(data);
        console.log("Total tracks in data.json:", totalTracks);

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
                    trackDataLoadedPercentage += (1 / totalTracks) * 100;
                    // console.log("Loading track progress: " + trackDataLoadedPercentage.toFixed(1) + "%");
                }
                // Update the loading progress
                // albumDataLoadedPercentage += (1 / numberOfAlbums) * 100;
                // console.log("Loading album progress: " + Math.round(albumDataLoadedPercentage) + "%");
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
                    if (indexField === 'Aliases') {
                        if (!doc.Aliases || (Array.isArray(doc.Aliases) && doc.Aliases.length === 0)) {
                            doc.Aliases = '';
                        } else if (Array.isArray(doc.Aliases)) {
                            doc.Aliases = doc.Aliases.join(', ');
                        }
                    }
                    this.add(doc);
                }, this);
            });
            let endTimeInMilliseconds = Date.now();
            console.log("Indexing " + indexField + " took " + (endTimeInMilliseconds - startTimeInMilliseconds) + " milliseconds.");
            return idx;
        }

        const idxText = indexOnField('Text');
        const idxSpeaker = indexOnField('Speaker');

        // Build a track-level alias index
        function buildTrackAliasIndex() {
            // We'll scan the original data structure to find all unique tracks and their Aliases
            // To do this, we need to reload the original JSON (not subtitle-level docs)
            // We'll fetch the data again, but only for this index
            // This is a workaround for the current data flow
            // If you want to optimize, refactor to keep the original album/track structure in memory
            let trackDocs = [];
            // Try to get the original data from the same source as loadData
            // This assumes BASE_URL and data.json are available
            // We'll use a synchronous XHR for simplicity (since this is only for index build)
            let rawData = null;
            const xhr = new XMLHttpRequest();
            xhr.open('GET', BASE_URL + '/assets/json/data.json', false); // sync
            xhr.send(null);
            if (xhr.status === 200) {
                rawData = JSON.parse(xhr.responseText);
            }
            if (rawData && rawData.Albums) {
                rawData.Albums.forEach(album => {
                    album.Tracks.forEach(track => {
                        trackDocs.push({
                            id: `${album.Album}|||${track.Track_Title}`,
                            Album: album.Album,
                            Album_Slug: album.Album_Slug,
                            Track_Title: track.Track_Title,
                            Track_Slug: track.Track_Slug,
                            Aliases: (Array.isArray(track.Aliases) ? track.Aliases.join(', ') : (track.Aliases || '')),
                            Album_Picture: album.Album_Picture
                        });
                    });
                });
            }
            const idx = lunr(function () {
                this.ref('id');
                this.field('Aliases');
                this.field('Track_Title');
                trackDocs.forEach(function (doc) {
                    this.add(doc);
                }, this);
            });
            return { idx, trackDocs };
        }

        const { idx: idxTrackAlias, trackDocs: trackAliasDocs } = buildTrackAliasIndex();

        // Count the number of times Alex Trebek show up within a track
        function getNumberOfTracksThatAlexTrebekIsIn() {
            const resultsForAlexTrebek = idxSpeaker.search("+Alex +Trebek");
            let tracksWithAlexTrebek = new Set();
            resultsForAlexTrebek.forEach(function (resultForAlex) {
                const matchedDoc = dataStructure.find(doc => doc.id === resultForAlex.ref);
                const key = createKey(matchedDoc.Album, matchedDoc.Track_Title, matchedDoc.Speaker);
                
                // Add to Set only if the combination isn't already added
                if (!tracksWithAlexTrebek.has(key)) {
                    tracksWithAlexTrebek.add(key);
                }
            });
            const countOfAlexTrebek = tracksWithAlexTrebek.size;
            // console.log("Alex Trebek is found " + countOfAlexTrebek + " times.");
            return countOfAlexTrebek;
        }
        
        // Function to programmatically run the speakers search for "Alex Trebek"
        function runSpeakerSearchForAlexTrebek() {
            let resultsContainer = document.querySelector('#alex-tracks-span');
            if (!resultsContainer) {
                // Only run on the Alex Trebek page
                return;
            }
            let speakersSearchInput = document.querySelector('#speakers-search-input');
            if (!speakersSearchInput) {
                // Create a hidden input if it doesn't exist
                speakersSearchInput = document.createElement('input');
                speakersSearchInput.type = 'hidden';
                speakersSearchInput.id = 'speakers-search-input';
                document.body.appendChild(speakersSearchInput);
                // Attach the event listener as in main()
                speakersSearchInput.addEventListener('input', function () {
                    if (this.value.trim() !== "") {
                        const query = this.value.trim().split(' ').map(word => `+${word}`).join(' ');
                        const results = idxSpeaker.search(query);
                        resultsContainer.innerHTML = '';
                        let tracksWithSpeaker = new Set();
                        results.forEach(function (result) {
                            const matchedDoc = dataStructure.find(doc => doc.id === result.ref);
                            const key = createKey(matchedDoc.Album, matchedDoc.Track_Title, matchedDoc.Speaker);
                            if (!tracksWithSpeaker.has(key)) {
                                tracksWithSpeaker.add(key);
                                const albumAndTitleItem = document.createElement('li');
                                albumAndTitleItem.innerHTML = `
                                    <i><a href="${BASE_URL}/tracks/${matchedDoc.Album_Slug}/${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i> --
                                    ${matchedDoc.Album} <img src="${BASE_URL}/assets/img/albums/${matchedDoc.Album_Picture}" alt="${matchedDoc.Album}" width="15" height="15">
                                `;
                                resultsContainer.appendChild(albumAndTitleItem);
                            }
                        });
                    }
                });
            }
            speakersSearchInput.value = 'Alex Trebek';
            speakersSearchInput.dispatchEvent(new Event('input'));
        }

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
                if (this.value.trim() != "") {
                    const query = this.value.trim().split(' ').map(word => `+${word}`).join(' '); // Add + to each word for logical AND searching
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
                            <i><a href="${BASE_URL}/tracks/${matchedDoc.Album_Slug}/${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i>
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
                    const query = this.value.trim().split(' ').map(word => `+${word}`).join(' '); // Add + to each word for logical AND searching
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
                                <i><a href="${BASE_URL}/tracks/${matchedDoc.Album_Slug}/${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i> --
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

        // Set up the aliases search input listener
        if (document.querySelector('#aliases-search-input')) {
            document.querySelector('#aliases-search-input').addEventListener('input', function () {
                const query = this.value.trim().toLowerCase();
                const resultList = document.querySelector('#aliases-search-results');
                resultList.innerHTML = '';
                if (query === "") return;

                let tracksWithAliases = new Set();
                let matchCount = 0;
                trackAliasDocs.forEach(function (doc) {
                    // Lowercase aliases for case-insensitive search
                    const aliasesStr = (doc.Aliases || '').toLowerCase();
                    if (aliasesStr.includes(query)) {
                        const key = `${doc.Album}|||${doc.Track_Title}`;
                        if (!tracksWithAliases.has(key)) {
                            tracksWithAliases.add(key);
                            matchCount++;
                            const albumAndTitleItem = document.createElement('li');
                            albumAndTitleItem.innerHTML = `
                                <img src="${BASE_URL}/assets/img/albums/${doc.Album_Picture}" alt="${doc.Album}" width="25" height="25">
                                <i><a href="${BASE_URL}/tracks/${doc.Album_Slug}/${doc.Track_Slug}">${doc.Track_Title}</a></i> --
                                <b>Aliases:</b> ${doc.Aliases ? doc.Aliases : '<em>None</em>'} --
                                ${doc.Album}
                            `;
                            resultList.appendChild(albumAndTitleItem);
                        }
                    }
                });
                const totalCountContainer = document.createElement('div');
                totalCountContainer.style.marginBottom = '25px';
                totalCountContainer.innerHTML = `<br/><p>Unique track-alias combinations: ${matchCount}</p>`;
                resultList.insertBefore(totalCountContainer, resultList.firstChild);
            });
        }

        function onDomContentLoaded() {
            const countOfAlexTrebek = getNumberOfTracksThatAlexTrebekIsIn();
            const alexCountSpan = document.querySelector('#alex-count-span');
            if (alexCountSpan) {
                alexCountSpan.textContent = countOfAlexTrebek;
            } else {
                // console.error('Element with id "alex-count-span" not found.');
            }
            // Display the results for Alex Trebek
            runSpeakerSearchForAlexTrebek();
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
let albumDataLoadedPercentage = 0;
let trackDataLoadedPercentage = 0;
// Call the generalized function after data is loaded
main(function(dataReady) {
    if (dataReady) {
        dataLoaded = dataReady;
        handleSearchParameter();
    }
});
