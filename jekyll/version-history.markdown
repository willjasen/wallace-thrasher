---
layout: page
permalink: /version-history/
published: true
---

### v1.6.0

 - add pages for Aliases and Establishments and their searching thereof
 - better the layout for the tracks list of each album on the "Track Review" page

---

### v1.5.4

 - fix the index page layout by creating a redirect to another page
 - minor edits to typos

---

### v1.5.3

- stretchie is now available via [https://stretchie.net](https://stretchie.net) and [https://stretchie.org](https://stretchie.org)
- [https://stretchie.net](https://stretchie.net) will now be the primary domain for the project

---

### v1.5.2

- fix the album page for "Where In The Hell Is The Lavender House Soundtrack (2018)"
- a few various track updates

---

### v1.5.1

- fix typo within page track data for "Circus Tickets" on LPC 1
- add logo to site title (formatting isn't the best yet)
- add link to Talkin' Whipapedia at the bottom of each album page
- add [link to the Discord server](https://discord.gg/jjfQ25NJ) at the bottom of the page
- send webhook to the new Discord server after production builds

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