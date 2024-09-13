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
    This is the main function to execute
*/
async function main() {
    try {
        const data = await fetchData('/assets/data.json');
        console.log("Creating data structure...");
        let dataStructure = [];

        // Iterate through each album, track, and subtitle
        for (const albumKey of Object.keys(data)) {
            const album = data[albumKey];

            for (const track of album.Tracks) {
                const trackData = await fetchData(track.Track_JSONPath);

                for (const subtitleKey of Object.keys(trackData)) {
                    const subtitle = trackData[subtitleKey];

                    dataStructure.push({
                        id: `${album.Album}-${track.Track_Title}-${subtitle.Index}`, // Unique ID using track key and subtitle index
                        Album: album.Album,
                        Album_Picture: album.Album_Picture,
                        Track_Number: track.Track_Number,
                        Track_Title: track.Track_Title,
                        Speaker: subtitle.Speaker,
                        Text: subtitle.Text,
                        StartTime: subtitle["Start Time"],
                        EndTime: subtitle["End Time"]
                    });
                }
            }
        }
        //console.log(dataStructure);

        // Index the data and keep a timer of how long it takes
        let startTimeInMilliseconds = Date.now();
        const idx = lunr(function () {
            this.ref('id');
            //this.field('Album');
            //this.field('Album_Picture');
            //this.field('Track_Number');
            //this.field('Track_Title');
            //this.field('Start Time');
            //this.field('End Time');
            //this.field('Speaker');
            this.field('Text');

            dataStructure.forEach(function (doc) {
                //console.log("Indexing:", doc);
                this.add(doc);
            }, this);
        });
        let endTimeInMilliseconds = Date.now();
        console.log("Indexing subtitles took " + (endTimeInMilliseconds - startTimeInMilliseconds) + " milliseconds.");

        // Index the data and keep a timer of how long it takes
        startTimeInMilliseconds = Date.now();
        const idx2 = lunr(function () {
            this.ref('id');
            //this.field('Album');
            //this.field('Album_Picture');
            //this.field('Track_Number');
            //this.field('Track_Title');
            //this.field('Start Time');
            //this.field('End Time');
            this.field('Speaker');
            //this.field('Text');

            dataStructure.forEach(function (doc) {
                //console.log("Indexing:", doc);
                this.add(doc);
            }, this);
        });
        endTimeInMilliseconds = Date.now();
        console.log("Indexing speakers took " + (endTimeInMilliseconds - startTimeInMilliseconds) + " milliseconds.");

        // Set up the subititles search input listener
        if (document.querySelector('#subtitles-search-input')) {
            document.querySelector('#subtitles-search-input').addEventListener('input', function () {
                if (this.value != "") {
                    const query = this.value;
                    const results = idx.search(query);
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
                        //console.log("Matched Document:", matchedDoc);

                        const albumAndTitleItem = document.createElement('li');
                        albumAndTitleItem.innerHTML = `
                            <a href="/assets/png/${matchedDoc.Album_Picture}">
                                <img src="/assets/png/${matchedDoc.Album_Picture}" alt="${matchedDoc.Album}" width="25" height="25">
                            </a>
                            <strong>${matchedDoc.Album}</strong> - <i>${matchedDoc.Track_Title}</i><small> @ ${matchedDoc.StartTime}</small>
                        `;

                        const subtitleItem = document.createElement('ul'); // Create a new ul for indentation
                        const subtitleItemLi = document.createElement('li');
                        subtitleItemLi.innerHTML = `${matchedDoc.Speaker}: "${matchedDoc.Text}"`;
                        subtitleItem.appendChild(subtitleItemLi); // Append the subtitle item to the ul

                        albumAndTitleItem.appendChild(subtitleItem); // Append the ul to the albumAndTitleItem
                        resultList.appendChild(albumAndTitleItem); // Finally, append the albumAndTitleItem to the resultList
                    });
                    resultList.innerHTML += `<br/><div>Subtitles found: ${resultCount}</div>`;
                }
            });
        }

        // Set up the speakers search input listener
        if (document.querySelector('#speakers-search-input')) {
            document.querySelector('#speakers-search-input').addEventListener('input', function () {
                if (this.value.trim() !== "") {
                    const query = this.value.trim();
                    const results = idx2.search(query);
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
                        //console.log("Matched a doc, here's a key:", key);

                        // Add to Set only if the combination isn't already added
                        if (!tracksWithSpeaker.has(key)) {
                            //console.log("Adding a key:", key);
                            tracksWithSpeaker.add(key);

                            // Display the result
                            const resultItem = document.createElement('li');
                            resultItem.textContent = `Speaker: ${matchedDoc.Speaker} -- Track: ${matchedDoc.Track_Title}`;
                            resultList.appendChild(resultItem);
                        }
                        //}
                    });

                    // Display the count of unique track-speaker combinations
                    const trackCount = tracksWithSpeaker.size;
                    resultList.innerHTML += `<br/><p>Unique track-speaker combinations: ${trackCount}</p>`;
                }
            });
        }

        // Function to create a unique key
        function createKey(albumTitle, trackTitle, speaker) {
            return `${albumTitle}-${trackTitle}-${speaker}`;
        }


    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Execute this program
main();