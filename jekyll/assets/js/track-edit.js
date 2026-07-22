(function () {
  'use strict';

  var cleanupCurrentPage = function () {};

  function el(tag, attributes, text) {
    var element = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function getStoredIdentity() {
    try {
      var stored = sessionStorage.getItem('wt-identity');
      if (!stored) return null;
      var identity = JSON.parse(stored);
      if (identity.exp < Date.now()) {
        sessionStorage.removeItem('wt-identity');
        return null;
      }
      return identity;
    } catch (_) {
      return null;
    }
  }

  function parseIdentityFragment() {
    var idMatch = window.location.hash.match(/[#&]wt-identity=([^&]+)/);
    var errorMatch = window.location.hash.match(/[#&]wt-auth-error=([^&]+)/);
    var shouldEnterEditMode = false;

    if (idMatch) {
      try {
        var identity = JSON.parse(decodeURIComponent(idMatch[1]));
        if (identity.exp > Date.now()) {
          sessionStorage.setItem('wt-identity', JSON.stringify(identity));
          shouldEnterEditMode = true;
        }
      } catch (_) {
        // Ignore a malformed callback fragment.
      }
    } else if (errorMatch) {
      console.warn('GitHub OAuth error:', decodeURIComponent(errorMatch[1]));
    }

    if (idMatch || errorMatch) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return shouldEnterEditMode;
  }

  function initializeTrackEdit() {
    cleanupCurrentPage();
    cleanupCurrentPage = function () {};

    var root = document.querySelector('[data-track-edit-root]');
    if (!root || root.dataset.trackEditInitialized === 'true') return;
    root.dataset.trackEditInitialized = 'true';

    var editToggle = root.querySelector('#suggest-edit-toggle');
    var subtitleList = document.getElementById('subtitleList');
    if (!editToggle || !subtitleList) return;

    var albumSlug = root.dataset.albumSlug;
    var trackSlug = root.dataset.trackSlug;
    var githubClientId = root.dataset.githubClientId;
    var editMode = false;
    var autoEnterEditMode = parseIdentityFragment();
    var inputs = Array.prototype.slice.call(
      subtitleList.querySelectorAll('.sub-speaker-input, .sub-text-input')
    );
    inputs.forEach(function (input) { input.dataset.originalValue = input.value; });

    var bar = el('div', { class: 'suggest-edit-bar' });
    var barTop = el('div', { class: 'suggest-edit-bar-top' });
    var identityElement = el('div', { class: 'suggest-edit-identity' });
    var changeCount = el('span', { class: 'suggest-edit-count' }, '0 changes');
    var note = el('input', {
      class: 'suggest-edit-note',
      type: 'text',
      placeholder: 'Optional note for reviewer…',
      maxlength: '500',
      'aria-label': 'Optional note for reviewer'
    });
    var submit = el('button', { class: 'suggest-edit-submit', type: 'button' }, 'Submit suggestions');
    var cancel = el('button', { class: 'suggest-edit-cancel', type: 'button' }, 'Cancel');
    var result = el('div', { class: 'suggest-edit-result', role: 'status', 'aria-live': 'polite' });
    submit.disabled = true;

    barTop.appendChild(identityElement);
    barTop.appendChild(changeCount);
    barTop.appendChild(note);
    barTop.appendChild(submit);
    barTop.appendChild(cancel);
    bar.appendChild(barTop);
    bar.appendChild(result);
    document.body.appendChild(bar);

    function startGitHubOAuth() {
      var state = encodeURIComponent(JSON.stringify({
        returnUrl: window.location.pathname + window.location.search
      }));
      var redirectUri = window.location.origin + '/.netlify/functions/github-oauth-callback';
      window.location.href = 'https://github.com/login/oauth/authorize' +
        '?client_id=' + encodeURIComponent(githubClientId) +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&scope=public_repo' +
        '&state=' + state;
    }

    function renderToggle() {
      var identity = getStoredIdentity();
      editToggle.innerHTML = '';
      editToggle.appendChild(el(
        'span',
        { class: 'suggest-edit-action' },
        editMode ? '✕ Exit edit mode' : '✏️ Suggest edits'
      ));

      if (identity) {
        var githubIdentity = el('span', {
          class: 'github-identity',
          title: 'Signed in with GitHub as ' + identity.login
        });
        githubIdentity.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.71.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.5-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.52-.01-.53.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.91-3.64-4.02 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.42 7.42 0 0 1 8 3.93c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.12-1.87 3.81-3.65 4.02.29.25.54.74.54 1.51 0 1.09-.01 1.97-.01 2.24 0 .22.15.47.55.39A8.01 8.01 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z"></path></svg>';
        githubIdentity.appendChild(document.createTextNode(identity.login));
        editToggle.appendChild(githubIdentity);
      }

      editToggle.setAttribute(
        'aria-label',
        (editMode ? 'Exit edit mode' : 'Suggest edits') +
          (identity ? '; signed in with GitHub as ' + identity.login : '')
      );
    }

    function renderIdentity(identity) {
      identityElement.innerHTML = '';
      if (!identity) return;

      identityElement.appendChild(el('img', {
        src: identity.avatar_url,
        alt: '',
        width: '20',
        height: '20'
      }));
      identityElement.appendChild(document.createTextNode('@' + identity.login));
      var signOut = el('button', {
        class: 'suggest-edit-sign-out',
        type: 'button',
        title: 'Sign out',
        'aria-label': 'Sign out of GitHub'
      }, '×');
      signOut.addEventListener('click', function () {
        sessionStorage.removeItem('wt-identity');
        exitEditMode();
        renderToggle();
      });
      identityElement.appendChild(signOut);
    }

    function getEdits() {
      var edits = [];
      subtitleList.querySelectorAll('.subtitle-line[data-sub-index]').forEach(function (line) {
        var speakerInput = line.querySelector('.sub-speaker-input');
        var textInput = line.querySelector('.sub-text-input');
        var speakerChanged = speakerInput && speakerInput.value !== speakerInput.dataset.originalValue;
        var textChanged = textInput && textInput.value !== textInput.dataset.originalValue;
        if (!speakerChanged && !textChanged) return;

        var edit = { index: parseInt(line.dataset.subIndex, 10) };
        if (speakerChanged) edit.speaker = speakerInput.value;
        if (textChanged) edit.text = textInput.value;
        edits.push(edit);
      });
      return edits;
    }

    function updateCount() {
      var editCount = getEdits().length;
      changeCount.textContent = editCount + ' change' + (editCount === 1 ? '' : 's');
      submit.disabled = editCount === 0;
    }

    function enterEditMode() {
      var identity = getStoredIdentity();
      if (!identity) {
        startGitHubOAuth();
        return;
      }
      editMode = true;
      renderIdentity(identity);
      editToggle.style.borderColor = '#666';
      editToggle.style.color = '#aaa';
      renderToggle();
      subtitleList.querySelectorAll('.sub-view').forEach(function (view) { view.style.display = 'none'; });
      subtitleList.querySelectorAll('.sub-edit').forEach(function (edit) { edit.style.display = 'flex'; });
      bar.style.display = 'flex';
      result.textContent = '';
      updateCount();
    }

    function exitEditMode() {
      editMode = false;
      editToggle.style.borderColor = '';
      editToggle.style.color = '';
      renderToggle();
      subtitleList.querySelectorAll('.sub-view').forEach(function (view) { view.style.display = ''; });
      subtitleList.querySelectorAll('.sub-edit').forEach(function (edit) { edit.style.display = ''; });
      bar.style.display = 'none';
    }

    editToggle.addEventListener('click', function () {
      if (editMode) exitEditMode();
      else enterEditMode();
    });
    cancel.addEventListener('click', exitEditMode);
    inputs.forEach(function (input) { input.addEventListener('input', updateCount); });

    submit.addEventListener('click', async function () {
      var edits = getEdits();
      if (edits.length === 0) return;
      submit.disabled = true;
      submit.textContent = 'Submitting…';
      result.textContent = '';
      result.style.color = 'lavender';

      try {
        var response = await fetch('/.netlify/functions/suggest-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            edit_type: 'Track',
            album_slug: albumSlug,
            track_slug: trackSlug,
            edits: edits,
            note: note.value.trim() || undefined,
            auth: getStoredIdentity() || undefined,
            _hp: ''
          })
        });
        var data = await response.json();
        if (!data.ok) throw new Error(data.error || 'Unknown error');

        result.style.color = 'greenyellow';
        result.innerHTML = 'Thank you! Suggestion submitted: ';
        var pullRequestLink = el('a', {
          href: data.pr_url,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, 'PR #' + data.pr_number + ' 🔗');
        pullRequestLink.style.color = 'greenyellow';
        pullRequestLink.style.fontWeight = 'bold';
        pullRequestLink.style.textDecoration = 'underline';
        result.appendChild(pullRequestLink);
        exitEditMode();
        editToggle.style.display = 'none';
        bar.style.display = 'flex';
      } catch (error) {
        result.style.color = '#ff6b6b';
        result.textContent = error.message === 'Failed to fetch'
          ? 'Network error. Please try again.'
          : 'Error: ' + error.message;
      } finally {
        submit.textContent = 'Submit suggestions';
        submit.disabled = getEdits().length === 0;
      }
    });

    renderToggle();
    if (autoEnterEditMode) enterEditMode();

    cleanupCurrentPage = function () {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    };
  }

  initializeTrackEdit();
  document.addEventListener('soft-nav', initializeTrackEdit);
})();
