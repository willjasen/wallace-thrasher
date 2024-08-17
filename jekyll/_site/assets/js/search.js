// Load the search index
fetch('/assets/json/Booper.json')
    .then(response => response.json())
    .then(function(data) {
        const idx = lunr(function () {
            this.ref('No.');
            this.field('Timecode In');
            this.field('Timecode Out');
            this.field('Subtitle');
            this.field('Speaker');
            this.field('Line');

            data.forEach(function (doc) {
                console.log("Indexing:", doc);
                this.add(doc);
            }, this);
        });

        // Set up the search input listener
        document.querySelector('#search-input').addEventListener('input', function () {
            const query = this.value;
            const results = idx.search(query);

            console.log("Search results:", results);

            // Clear previous results
            const resultList = document.querySelector('#search-results');
            resultList.innerHTML = '';

            // Display search results
            results.forEach(function (result) {
                const matchedDoc = data.find(doc => String(doc['No.']) === result.ref);
                console.log("Matched Document:", matchedDoc);
                const resultItem = document.createElement('li');
                resultItem.innerHTML = `${matchedDoc.Speaker}: ${matchedDoc.Line}`;
                resultList.appendChild(resultItem);
            });
        });
    });
