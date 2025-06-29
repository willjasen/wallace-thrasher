---
layout: page
permalink: /version-history/
published: true
---


### v1.5.1

- fix typo within page track data for "Circus Tickets" on LPC 1
- add logo to site title (formatting isn't the best yet)
- add link to Talkin'Whipapedia at the bottom of each album page
- add link to the new Discord server at the bottom of the page
- send webhook to the new Discord server production builds

---

### v1.5.0

- updated all known tracks (excluding themes) that include Alex Trebek
- Alex Trebek's page now displays the tracks he is included in
- updated the format of the Albums page
- added link in the README and About page to [the lpc merch site at noisetent.com](http://noisetent.com/lpcmerchandise.htm)

---

### v1.4.1

- updates to the README and About pages
- minor fixes for "Drug Dumpling" (still needs a redo)

---

### v1.4.0

- website's title is renamed to 'stretchie'
- change search feature to use logical 'AND' instead of logical 'OR'
	- search results returned will now include only all words entered
- allow URL parameter for search (https://stretchie.delivery/subtitles/?search=cheese+pizza)
- deploy website to IPFS
	- renamed 'publish-for-netlify.yml' to 'deploy-production-build.yml'
	- 'deploy-production-build.yml' builds the website as a production build and publishes the built site's contents to the 'production-build' branch
	- 'deploy-production-build.yml' deploys the site to IPFS via [Filebase](https://filebase.com/) and [Storacha](https://storacha.network/) using the 'production-build' branch, then updates the `_dnslink` TXT DNS record for the "[stretchie.delivery](https://stretchie.delivery)" domain to reflect the new IPFS hash