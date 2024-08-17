async function fetchData(path) {
    try {
        const response = await fetch(path);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function main() {
    try {
        const data = await fetchData('/assets/data.json');

        let flatData = [];

        // Iterate through each album
        for (const albumKey of Object.keys(data)) {
            const album = data[albumKey];

            // Use for...of loop to handle async fetchData calls
            for (const track of album.Tracks) {
                const trackData = await fetchData(track.Track_JSONPath); // Await the fetchData call
                
                for (const subtitleKey of Object.keys(trackData)) {
                    const subtitle = trackData[subtitleKey];

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
                }
            }
        }

        // You can now use the flatData for further processing or indexing
        console.log(flatData);

        // Index the data and setup the search (your existing code can go here)
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

    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Call the main function
main();