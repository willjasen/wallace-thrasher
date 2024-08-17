// Load the search index
fetch('/assets/data.json')
    .then(response => response.json())
    .then(function(data) {
        
        let flatData = [];

        // Iterate through each track
        Object.keys(data).forEach(albumKey => {
            const album = data[albumKey];

            /* THIS PART WORKS */
            // For each album, track, and subtitle - flatten the structure
            /*album.Tracks.forEach(track => {
                track.Subtitles.forEach(subtitle => {
                    //console.log(track.Track_Title);
                    flatData.push({
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
                }) 
            });*/

            album.Tracks.forEach(track => {
                fetch(track.Track_JSONPath)
                    .then(response => response.json())
                    .then(function(trackData) {
                        Object.keys(trackData).forEach(trackKey => {
                            const subtitle = trackData[trackKey];
                            console.log(track.Track_Title);
                            //console.log(subtitle);

                            flatData.push({
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
                        });
                    });
            });
        });

        console.log(flatData);

        // Index the data
        const idx = lunr(function () {
            this.ref('id');
            this.field('Album');
            this.field('Album_Picture');
            this.field('Track_Number');
            this.field('Track_Title');
            this.field('Start Time');
            this.field('End Time');
            this.field('Speaker');
            this.field('Text');

            // Custom pipeline function to inspect tokens
            /*this.pipeline.before(lunr.trimmer, function (token) {
                console.log("Tokenizing:", token.toString());
                return token;
            });*/

            

            flatData.forEach(function (doc) {
                //console.log("Indexing:", doc);
                this.add(doc);
            }, this);

            console.log("Indexing complete.");
        });

        // Set up the search input listener
        document.querySelector('#search-input').addEventListener('input', function () {
            if(this.value != "") {
                const query = this.value;
                const results = idx.search(query);
                console.log("Search query:", query);
                console.log("Search results:", results);

                // Clear previous results
                const resultList = document.querySelector('#search-results');
                resultList.innerHTML = '';

                // Display search results
                results.forEach(function (result) {

                    const matchedDoc = flatData.find(doc => doc.id === result.ref);
                    console.log("Matched Document:", matchedDoc);

                    const albumAndTitleItem = document.createElement('li');
                    albumAndTitleItem.innerHTML = `
                        <a href="/assets/png/${matchedDoc.Album_Picture}">
                            <img src="/assets/png/${matchedDoc.Album_Picture}" alt="${matchedDoc.Album}" width="25" height="25">
                        </a>
                        <strong>${matchedDoc.Album}</strong> - ${matchedDoc.Track_Title}
                    `;

                    const subtitleItem = document.createElement('ul'); // Create a new ul for indentation
                    const subtitleItemLi = document.createElement('li');
                    subtitleItemLi.innerHTML = `${matchedDoc.Speaker}: ${matchedDoc.Text}`;
                    subtitleItem.appendChild(subtitleItemLi); // Append the subtitle item to the ul

                    albumAndTitleItem.appendChild(subtitleItem); // Append the ul to the albumAndTitleItem
                    resultList.appendChild(albumAndTitleItem); // Finally, append the albumAndTitleItem to the resultList

                });
            }
            
        });
    });
