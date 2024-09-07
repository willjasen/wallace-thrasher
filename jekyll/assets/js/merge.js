/* THIS MERGES THE TWO SUBTITLES FILES */

// URLs of the JSON files on the web server
const url1 = '/assets/json/Best_Before_24_Medley.json';
const url2 = '/assets/json/Body_Art_Flipout.json';

async function fetchAndMergeJSON(url1, url2) {
    try {
        // Fetch both JSON files concurrently
        const [response1, response2] = await Promise.all([
            fetch(url1),
            fetch(url2)
        ]);

        // Ensure both requests were successful
        if (!response1.ok || !response2.ok) {
            throw new Error('Failed to fetch one or more JSON files.');
        }

        // Parse both JSON responses
        const jsonData1 = await response1.json();
        const jsonData2 = await response2.json();

        // Merge the JSON objects (this assumes both are objects; adjust if they are arrays)
        const mergedData = [...jsonData1, ...jsonData2];

        // Output the merged object
        console.log(mergedData);
        return mergedData;
    } catch (error) {
        console.error('Error fetching or merging JSON files:', error);
    }
}

// Call the function to fetch and merge the JSON files
fetchAndMergeJSON(url1, url2);
