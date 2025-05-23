---
layout: page
permalink: /version-history/
published: true
---

### v1.4.1

- updates to the README and About pages
- minor fixes for "Drug Dumpling" (still needs a redo)

### v1.4.0

- website's title is renamed to 'stretchie'
- change search feature to use logical 'AND' instead of logical 'OR'
	- search results returned will now include only all words entered
- allow URL parameter for search (https://stretchie.delivery/subtitles/?search=cheese+pizza)
- deploy website to IPFS
	- renamed 'publish-for-netlify.yml' to 'deploy-production-build.yml'
	- 'deploy-production-build.yml' builds the website as a production build and publishes the built site's contents to the 'production-build' branch
	- 'deploy-production-build.yml' deploys the site to IPFS via [Filebase](https://filebase.com/) and [Storacha](https://storacha.network/) using the 'production-build' branch, then updates the `_dnslink` TXT DNS record for the "[stretchie.delivery](https://stretchie.delivery)" domain to reflect the new IPFS hash