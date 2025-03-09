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

    console.log("Creating the data structure...");
    const data = await fetchData('/assets/json/combined_data.json');
    let dataStructure = [];

    // Iterate through each album, track, and subtitle
    for (const albumsKey of Object.keys(data)) {
        const albums = data[albumsKey];
        
        for(const album of albums) {
            console.log(album);
            for (const track of album.Tracks) {
                // const jsonPath = "/assets/json/"+album.Album_Slug+"/"+track.Track_JSONPath;
                //trackData = await fetchData(jsonPath);
                console.log(track);
                for (const subtitle of track.Subtitles) {
                    dataStructure.push({
                        id: `${album.Album}-${track.Track_Title}-${subtitle.Index}`, // create a unique ID for each subtitle using album, track title, and subtitle index
                        Album: album.Album,
                        Album_Picture: album.Album_Picture,
                        Album_Slug: album.Album_Slug,
                        Track_Number: track.Track_Number,
                        Track_Slug: track.Track_Slug,
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
    }

    return dataStructure;
}

/*
    This is the main function that loads in the JSON data, creates a data structure, and indexes the data for search
*/
async function main(callback) {
    try {

        // Load the data
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
                            <img src="/assets/img/albums/${matchedDoc.Album_Picture}" alt="${matchedDoc.Album}" width="25" height="25">
                            <strong>${matchedDoc.Album}</strong> - 
                            <i><a href="/tracks/${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i>
                            <small> @ ${matchedDoc.StartTime}</small>
                        `;

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
                                <i><a href="/tracks/${matchedDoc.Track_Slug}">${matchedDoc.Track_Title}</a></i> --
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
    if (dataReady) {
      dataLoaded = dataReady;
    }
  });
