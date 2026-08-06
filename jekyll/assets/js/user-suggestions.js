(function () {
  const root = document.querySelector('.suggestions-page');
  if (!root) return;
  const repo = root.dataset.repository;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => new Date(value).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  fetch(`https://api.github.com/repos/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`, {headers:{Accept:'application/vnd.github+json'}})
    .then(response => { if (!response.ok) throw new Error('GitHub returned ' + response.status); return response.json(); })
    .then(pulls => {
      const suggestions = pulls.filter(pr => /^\[Suggestion\]/i.test(pr.title));
      const people = {};
      suggestions.forEach(pr => { const login = pr.user && pr.user.login; if (login) people[login] = people[login] ? {...people[login], count: people[login].count + 1} : {count: 1, avatar: pr.user.avatar_url}; });
      const merged = suggestions.filter(pr => pr.merged_at).length;
      document.getElementById('suggestion-total').textContent = suggestions.length;
      document.getElementById('suggestion-contributors').textContent = Object.keys(people).length;
      document.getElementById('suggestion-merged').textContent = merged;
      document.getElementById('suggestion-open').textContent = suggestions.filter(pr => pr.state === 'open').length;
      document.getElementById('suggestion-updated').textContent = 'Updated ' + new Date().toLocaleDateString();
      document.getElementById('contributor-list').innerHTML = Object.entries(people).sort((a,b) => b[1].count-a[1].count || a[0].localeCompare(b[0])).map(([login,person],i) => `<div class="contributor"><span class="contributor-rank">${String(i+1).padStart(2,'0')}</span><a class="contributor-person" href="https://github.com/${esc(login)}" target="_blank" rel="noopener noreferrer"><img class="contributor-avatar" src="${esc(person.avatar)}" alt="${esc(login)}'s GitHub profile photo" loading="lazy"><span>@${esc(login)}</span></a><span class="contributor-count">${person.count} ${person.count === 1 ? 'change' : 'changes'}</span></div>`).join('') || '<p class="suggestions-loading">No suggestions have been submitted yet.</p>';
      document.getElementById('suggestion-list').innerHTML = suggestions.slice(0,20).map(pr => `<article class="suggestion"><div><a class="suggestion-title" href="${esc(pr.html_url)}" target="_blank" rel="noopener noreferrer">${esc(pr.title.replace(/^\[Suggestion\]\s*/i,''))}</a><div class="suggestion-meta"><a class="suggestion-author" href="https://github.com/${esc(pr.user && pr.user.login)}" target="_blank" rel="noopener noreferrer"><img class="suggestion-avatar" src="${esc(pr.user && pr.user.avatar_url)}" alt="${esc(pr.user && pr.user.login)}'s GitHub profile photo" loading="lazy"><span>@${esc(pr.user && pr.user.login)}</span></a><span>${date(pr.created_at)}</span><span>PR #${pr.number}</span></div></div><span class="suggestion-status ${pr.state === 'open' ? 'open' : ''}">${pr.merged_at ? 'merged' : pr.state}</span></article>`).join('') || '<p class="suggestions-loading">No suggestions have been submitted yet.</p>';
    })
    .catch(error => { document.getElementById('contributor-list').innerHTML = `<p class="suggestions-error">Suggestion history is temporarily unavailable. <a href="https://github.com/${repo}/pulls?q=is%3Apr+%5BSuggestion%5D">Open the GitHub pull requests ↗</a></p>`; document.getElementById('suggestion-list').innerHTML = ''; console.warn(error); });
}());
