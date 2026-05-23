---
layout: page
title: Instructions
permalink: /instructions/
published: true
---

### 🧭 Overview 🧭

there are four pages that utilize the search feature.

the "[Aliases]({{ site.baseurl }}/aliases)" page ...

the "[Establishments]({{ site.baseurl }}/establishments)" page ...

the "[Speakers]({{ site.baseurl }}/speakers)" page ...

the "[Subtitles]({{ site.baseurl }}/subtitles)" page ...

---

### 🔎 Searching 🔎

the search feature uses a logical 'and' when operating, instead of a logical 'or'. this change in behavior affects when multiple words are searched. before, the search would return any subtitles containing any word that was entered. now, the search will only return subtitles that contain all words being searched.

for example, a search term of "cheese pizza" previously return 134 results - all subtitles containing either the word "cheese" or "pizza". now, the same search of "cheese pizza" returns 7 results - all subtitles containing both the words "cheese" and "pizza".

note that results returned are not based on phrase matching. for example, a subtitle of "i want a cheese pizza" will be returned, but so will "i would like cheese on my pizza". due to limitations of [lunr.js](https://lunrjs.com/), phrase matching is not possible.

also note that the ordering of the words does not matter, so a search for "cheese pizza" and for "pizza cheese" will return the same results.