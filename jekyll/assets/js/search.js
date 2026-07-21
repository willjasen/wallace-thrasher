---

---
// These 3 lines above must stay because they are used like front matter for Jekyll to process

// Globals read by load-search-with-progress.html — initialized once, preserved across re-executions
window.dataLoaded = window.dataLoaded || false;
window.albumDataLoadedPercentage = window.albumDataLoadedPercentage || 0;
window.trackDataLoadedPercentage = window.trackDataLoadedPercentage || 0;

// search.js
;(function() {
if (window._wtSearchLoaded) return;
window._wtSearchLoaded = true;

const BASE_URL = '{{ site.baseurl }}';
console.log("BASE_URL: " + (BASE_URL ? BASE_URL : "<null>"));
const BUILD_TIMESTAMP = '{{ site.time | date: "%s" }}';

/*
    Save any serializable value as a synthetic Cache API entry under cacheName / cacheKey.
*/
async function saveToCache(cacheName, cacheKey, data) {
    try {
        const cache = await caches.open(cacheName);
        const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(cacheKey, response);
    } catch (error) {
        console.warn('Failed to save to cache:', cacheKey, error);
    }
}

/*
    Load and parse a synthetic Cache API entry. Returns null on miss or error.
*/
async function loadFromCache(cacheName, cacheKey) {
    try {
        const cache = await caches.open(cacheName);
        const response = await cache.match(cacheKey);
        if (!response) return null;
        return response.json();
    } catch (error) {
        console.warn('Failed to load from cache:', cacheKey, error);
        return null;
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
async function loadData(data) {
    const dataStructure = [];
    const totalTracks = getTotalTracks(data);

    for (const album of data.Albums) {
        for (const track of (album.Tracks || [])) {
            for (const subtitle of (track.Subtitles || [])) {
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
                    Subtitle_Index: subtitle.Index,
                    Speaker: subtitle.Speaker,
                    Text: subtitle.Text,
                    StartTime: subtitle["Start Time"],
                    EndTime: subtitle["End Time"],
                    Whisper_Model: track.Whisper_Model
                });
            }
            trackDataLoadedPercentage += (1 / totalTracks) * 100;
        }
    }
    albumDataLoadedPercentage = 100;
    console.log("All data has been loaded from data.combined.json.");
    return dataStructure;
}

/*
    Yield control back to the browser's task queue, breaking up long tasks and
    preventing 'setTimeout handler took Xms' violations in DevTools.
*/
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

/*
    This is the main function that loads in the JSON data, creates a data structure, and indexes the data for search
*/
async function main(callback) {
        const rawDataJson = await window.WallaceThrasherAPI.getData();

    try {
        var jekyll_env = '{{ jekyll.environment }}';
        dataStructure = await loadData(rawDataJson);
        const dataMap = new Map(dataStructure.map(doc => [doc.id, doc]));

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
            console.log("Indexing " + indexField + " took", (endTimeInMilliseconds - startTimeInMilliseconds), "milliseconds.");
            return idx;
        }

        const cacheName = 'wallace-thrasher-' + BUILD_TIMESTAMP;

        let idxText;
        await yieldToMain();
        if ('caches' in window) {
            const cached = await loadFromCache(cacheName, '/wt-cache/idx-Text');
            if (cached) {
                let startTimeInMilliseconds = Date.now();
                idxText = lunr.Index.load(cached);
                console.log('Loading Text index from cache took', (Date.now() - startTimeInMilliseconds), 'milliseconds.');
            }
        }
        if (!idxText) {
            idxText = indexOnField('Text');
            if ('caches' in window) await saveToCache(cacheName, '/wt-cache/idx-Text', idxText.toJSON());
        }

        let idxSpeaker;
        await yieldToMain();
        if ('caches' in window) {
            const cached = await loadFromCache(cacheName, '/wt-cache/idx-Speaker');
            if (cached) {
                let startTimeInMilliseconds = Date.now();
                idxSpeaker = lunr.Index.load(cached);
                console.log('Loading Speaker index from cache took', (Date.now() - startTimeInMilliseconds), 'milliseconds.');
            }
        }
        if (!idxSpeaker) {
            idxSpeaker = indexOnField('Speaker');
            if ('caches' in window) await saveToCache(cacheName, '/wt-cache/idx-Speaker', idxSpeaker.toJSON());
        }

        // Build a track-level alias docs array
        function buildTrackAliasDocs(rawData) {
            let startTimeInMilliseconds = Date.now();
            let trackDocs = [];
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
            let endTimeInMilliseconds = Date.now();
            console.log("Building track alias docs took", (endTimeInMilliseconds - startTimeInMilliseconds), "milliseconds.");
            return trackDocs;
        }

        await yieldToMain();
        const trackAliasDocs = buildTrackAliasDocs(rawDataJson);

        // Build a track-level establishment docs array
        function buildTrackEstablishmentDocs(rawData) {
            let startTimeInMilliseconds = Date.now();
            let trackDocs = [];
            if (rawData && rawData.Albums) {
                rawData.Albums.forEach(album => {
                    album.Tracks.forEach(track => {
                        trackDocs.push({
                            id: `${album.Album}|||${track.Track_Title}`,
                            Album: album.Album,
                            Album_Slug: album.Album_Slug,
                            Track_Title: track.Track_Title,
                            Track_Slug: track.Track_Slug,
                            Establishments: (Array.isArray(track.Establishments) ? track.Establishments.join(', ') : (track.Establishments || '')),
                            Album_Picture: album.Album_Picture
                        });
                    });
                });
            }
            let endTimeInMilliseconds = Date.now();
            console.log("Building track establishment docs took", (endTimeInMilliseconds - startTimeInMilliseconds), "milliseconds.");
            return trackDocs;
        }

        await yieldToMain();
        const trackEstablishmentDocs = buildTrackEstablishmentDocs(rawDataJson);

        // Count the number of times Alex Trebek show up within a track
        function getNumberOfTracksThatAlexTrebekIsIn() {
            const resultsForAlexTrebek = idxSpeaker.search("+Alex +Trebek");
            let tracksWithAlexTrebek = new Set();
            resultsForAlexTrebek.forEach(function (resultForAlex) {
                const matchedDoc = dataMap.get(resultForAlex.ref);
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
            const resultsContainer = document.querySelector('#alex-tracks-span');
            if (!resultsContainer) return; // Only run on the Alex Trebek page

            const results = idxSpeaker.search('+Alex +Trebek');
            resultsContainer.innerHTML = '';
            let tracksWithSpeaker = new Set();
            results.forEach(function (result) {
                const matchedDoc = dataMap.get(result.ref);
                const key = createKey(matchedDoc.Album, matchedDoc.Track_Title, matchedDoc.Speaker);
                if (!tracksWithSpeaker.has(key)) {
                    tracksWithSpeaker.add(key);
                    const albumAndTitleItem = document.createElement('li');
                    albumAndTitleItem.className = 'alex-track-item';

                    const albumImage = document.createElement('img');
                    albumImage.className = 'alex-track-image';
                    albumImage.src = `${BASE_URL}/assets/img/albums/${matchedDoc.Album_Picture}`;
                    albumImage.alt = matchedDoc.Album;
                    albumImage.width = 32;
                    albumImage.height = 32;

                    const textContainer = document.createElement('span');
                    const trackTitle = document.createElement('a');
                    trackTitle.className = 'alex-track-title';
                    trackTitle.href = `${BASE_URL}/tracks/?album=${matchedDoc.Album_Slug}&track=${matchedDoc.Track_Slug}`;
                    trackTitle.textContent = matchedDoc.Track_Title;

                    const albumTitle = document.createElement('span');
                    albumTitle.className = 'alex-track-album';
                    albumTitle.textContent = matchedDoc.Album;

                    textContainer.appendChild(trackTitle);
                    textContainer.appendChild(albumTitle);
                    albumAndTitleItem.appendChild(albumImage);
                    albumAndTitleItem.appendChild(textContainer);
                    resultsContainer.appendChild(albumAndTitleItem);
                }
            });
        }

        // Set up the subtitles search input listener (delegated so it survives soft-nav DOM swaps)
        window.fileMap = window.fileMap || {};
        document.addEventListener('input', function (e) {
            if (!e.target.matches('#subtitles-search-input')) return;
            (function (input) {
                if (input.value.trim() != "") {
                    const query = input.value.trim().split(' ').map(word => `+${word}`).join(' '); // Add + to each word for logical AND searching
                    const results = idxText.search(query).sort(function (a, b) {
                        const aDoc = dataMap.get(a.ref);
                        const bDoc = dataMap.get(b.ref);
                        const aYear = Number(aDoc.Album_Year);
                        const bYear = Number(bDoc.Album_Year);
                        const yearDifference = (Number.isFinite(aYear) ? aYear : Infinity) -
                            (Number.isFinite(bYear) ? bYear : Infinity);

                        if (yearDifference !== 0) return yearDifference;

                        const albumDifference = aDoc.Album.localeCompare(bDoc.Album, undefined, {
                            numeric: true,
                            sensitivity: 'base'
                        });
                        if (albumDifference !== 0) return albumDifference;

                        const aTrackNumber = Number(aDoc.Track_Number);
                        const bTrackNumber = Number(bDoc.Track_Number);
                        const trackDifference = (Number.isFinite(aTrackNumber) ? aTrackNumber : Infinity) -
                            (Number.isFinite(bTrackNumber) ? bTrackNumber : Infinity);

                        if (trackDifference !== 0) return trackDifference;

                        return Number(aDoc.Subtitle_Index) - Number(bDoc.Subtitle_Index);
                    });
                    //console.log("Search query:", query);
                    //console.log("Search results:", results);

                    // Clear previous results
                    const resultList = document.querySelector('#subtitles-search-results');
                    resultList.innerHTML = '';

                    // Display search results
                    let resultCount = 0;
                    results.forEach(function (result) {

                        resultCount++;
                        const matchedDoc = dataMap.get(result.ref);

                        const albumAndTitleItem = document.createElement('li');
                        albumAndTitleItem.innerHTML = `
                            <img src="${BASE_URL}/assets/img/albums/${matchedDoc.Album_Picture}" alt="${matchedDoc.Album}" width="25" height="25">
                            <strong>${matchedDoc.Album}</strong> - 
                            <i><a href="${BASE_URL}/tracks/?album=${matchedDoc.Album_Slug}&track=${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i>
                        `;

                        if (!window.fileMap || Object.keys(window.fileMap).length === 0) {
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
                                const matchingUrl = window.fileMap[relevantUrl];
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
            })(e.target);
        });

        // Set up the speakers search input listener (delegated)
        document.addEventListener('input', function (e) {
            if (!e.target.matches('#speakers-search-input')) return;
            (function (input) {
                if (input.value.trim() !== "") {
                    const query = input.value.trim().split(' ').map(word => `+${word}`).join(' '); // Add + to each word for logical AND searching
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
                        const matchedDoc = dataMap.get(result.ref);

                        //if (matchedDoc && matchedDoc.Speaker.includes(query)) {
                        const key = createKey(matchedDoc.Album, matchedDoc.Track_Title, matchedDoc.Speaker);

                        // Add to Set only if the combination isn't already added
                        if (!tracksWithSpeaker.has(key)) {
                            tracksWithSpeaker.add(key);

                            // Display the result
                            const albumAndTitleItem = document.createElement('li');
                            albumAndTitleItem.innerHTML = `
                                ${matchedDoc.Speaker} -- 
                                <i><a href="${BASE_URL}/tracks/?album=${matchedDoc.Album_Slug}&track=${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i> --
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
            })(e.target);
        });

        // Set up the aliases search input listener (delegated)
        document.addEventListener('input', function (e) {
            if (!e.target.matches('#aliases-search-input')) return;
            (function (input) {
                const query = input.value.trim().toLowerCase();
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
                                <i><a href="${BASE_URL}/tracks/?album=${doc.Album_Slug}&track=${doc.Track_Slug}">${doc.Track_Title}</a></i> --
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
            })(e.target);
        });

        // Set up the establishments search input listener (delegated)
        document.addEventListener('input', function (e) {
            if (!e.target.matches('#establishments-search-input')) return;
            (function (input) {
                const query = input.value.trim().toLowerCase();
                const resultList = document.querySelector('#establishments-search-results');
                resultList.innerHTML = '';
                if (query === "") return;

                let tracksWithEstablishments = new Set();
                let matchCount = 0;
                trackEstablishmentDocs.forEach(function (doc) {
                    const establishmentsStr = (doc.Establishments || '').toLowerCase();
                    if (establishmentsStr.includes(query)) {
                        const key = `${doc.Album}|||${doc.Track_Title}`;
                        if (!tracksWithEstablishments.has(key)) {
                            tracksWithEstablishments.add(key);
                            matchCount++;
                            const albumAndTitleItem = document.createElement('li');
                            albumAndTitleItem.innerHTML = `
                                <img src="${BASE_URL}/assets/img/albums/${doc.Album_Picture}" alt="${doc.Album}" width="25" height="25">
                                <i><a href="${BASE_URL}/tracks/?album=${doc.Album_Slug}&track=${doc.Track_Slug}">${doc.Track_Title}</a></i> --
                                <b>Establishments:</b> ${doc.Establishments ? doc.Establishments : '<em>None</em>'} --
                                ${doc.Album}
                            `;
                            resultList.appendChild(albumAndTitleItem);
                        }
                    }
                });
                const totalCountContainer = document.createElement('div');
                totalCountContainer.style.marginBottom = '25px';
                totalCountContainer.innerHTML = `<br/><p>Unique track-establishment combinations: ${matchCount}</p>`;
                resultList.insertBefore(totalCountContainer, resultList.firstChild);
            })(e.target);
        });

        // Cache the Alex Trebek count so the lunr search only runs once ever.
        let _cachedAlexCount = null;

        async function onDomContentLoaded() {
            // Only do Alex-related work when on the Alex Trebek page.
            const alexCountSpan = document.querySelector('#alex-count-span');
            const alexTracksSpan = document.querySelector('#alex-tracks-span');
            if (!alexCountSpan && !alexTracksSpan) return;

            if (alexCountSpan) {
                if (_cachedAlexCount === null) {
                    _cachedAlexCount = getNumberOfTracksThatAlexTrebekIsIn();
                }
                alexCountSpan.textContent = _cachedAlexCount;
            }
            await yieldToMain();
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

        // Expose so the module-level soft-nav listener can call it after async work is done
        window._wtOnDomContentLoaded = onDomContentLoaded;

        callback(true);

    } catch (error) {
        console.error('Error in main function:', error);
        callback(false);
    }
}

// Execute this program

// Disable all search inputs on page load
document.querySelectorAll('#subtitles-search-input, #speakers-search-input, #aliases-search-input, #establishments-search-input')
    .forEach(input => input && (input.disabled = true));

// Call the generalized function after data is loaded
main(function(dataReady) {
        if (dataReady) {
                dataLoaded = dataReady;
                // Enable all search inputs
                document.querySelectorAll('#subtitles-search-input, #speakers-search-input, #aliases-search-input, #establishments-search-input')
                    .forEach(input => input && (input.disabled = false));
                handleSearchParameter();
        }
});

// Re-run page-specific UI after soft-nav swaps the DOM.
// Registered here at module level (not inside async main()) so it is always
// active regardless of how long main() takes to finish.
document.addEventListener('soft-nav', function () {
    if (typeof window._wtOnDomContentLoaded === 'function') {
        setTimeout(window._wtOnDomContentLoaded, 0);
    }
});
})(); // close IIFE guard — prevents re-execution in the same window context (e.g. after soft-nav)
