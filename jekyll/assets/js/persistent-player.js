// persistent-player.js
// Manages a site-wide floating audio player FAB that survives page navigation
// via soft-nav (fetch + history.pushState), so audio keeps playing across pages.

(function () {
  'use strict';

  const isMobile = window.innerWidth <= 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
  if (isMobile) return;
  if (!('showDirectoryPicker' in window) && !('webkitdirectory' in document.createElement('input'))) return;

  // ── IndexedDB helpers ────────────────────────────────────────────────────────
  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open('lpc-usb-db', 1);
      req.onupgradeneeded = function (e) { e.target.result.createObjectStore('handles'); };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function getStoredHandle() {
    try {
      const db = await openDb();
      return await new Promise(function (resolve) {
        const tx = db.transaction('handles', 'readonly');
        const get = tx.objectStore('handles').get('lpcUsb');
        get.onsuccess = function () { resolve(get.result || null); };
        get.onerror = function () { resolve(null); };
      });
    } catch (e) { return null; }
  }
  async function storeHandle(handle) {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'lpcUsb');
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  // ── Build FAB DOM ────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #audioFab {
      position: fixed; bottom: 24px; right: 24px; z-index: 9000;
      height: 60px; min-width: 60px; border-radius: 30px;
      background: #5a5a9a; border: 2px solid #9a9adf;
      cursor: pointer; display: flex; flex-direction: row; align-items: center;
      justify-content: center; gap: 8px; padding: 0 18px;
      font-size: 28px; box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      transition: background 0.2s, box-shadow 0.2s; line-height: 1;
    }
    #audioFab:hover { background: #7a7abf; box-shadow: 0 6px 18px rgba(0,0,0,0.6); }
    #audioFabTime {
      font-size: 16px; font-weight: bold; color: #d0d0ff;
      letter-spacing: 0.04em; line-height: 1; display: none; white-space: nowrap;
    }
    #audioFabPanel {
      position: fixed; bottom: 102px; right: 24px; z-index: 8999;
      background: #1e1e3a; border: 1px solid #7a7abf;
      border-radius: 14px; padding: 16px 18px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.6);
      display: none; flex-direction: column; align-items: center;
      min-width: 300px; gap: 10px;
    }
    #audioFabPanel audio { width: 100%; margin-top: 4px; }
    #audioFabPanel .fab-panel-title { margin: 0; color: #b0b0e0; font-size: 0.78em; text-align: center; }
    #selectLpcBtn {
      color: greenyellow; background: none; border: 1px solid greenyellow;
      border-radius: 6px; padding: 6px 12px; cursor: pointer; font-weight: bold;
    }
  `;
  document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.id = 'audioFab';
  fab.title = 'Listen to track';
  fab.setAttribute('aria-label', 'Listen to track');
  fab.textContent = '🎧';

  const fabTimeLabel = document.createElement('span');
  fabTimeLabel.id = 'audioFabTime';
  fab.appendChild(fabTimeLabel);

  const fabPanel = document.createElement('div');
  fabPanel.id = 'audioFabPanel';

  const panelTitle = document.createElement('p');
  panelTitle.className = 'fab-panel-title';
  panelTitle.textContent = 'Select the top-level directory for the collection, usually named \u201CLPC USB\u201D';
  fabPanel.appendChild(panelTitle);

  const selectBtn = document.createElement('button');
  selectBtn.id = 'selectLpcBtn';
  selectBtn.textContent = 'Select LPC USB';
  fabPanel.appendChild(selectBtn);

  const audioPlayer = document.createElement('audio');
  audioPlayer.id = 'audioPlayer';
  audioPlayer.setAttribute('controls', '');
  audioPlayer.style.display = 'none';
  fabPanel.appendChild(audioPlayer);

  document.body.appendChild(fabPanel);
  document.body.appendChild(fab);

  // ── State ────────────────────────────────────────────────────────────────────
  window.fileMap = window.fileMap || {};   // path → blob URL
  let cachedHandle = null;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function formatTime(s) {
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function markLoaded() {
    audioPlayer.style.display = '';
    selectBtn.textContent = '✅ LPC USB loaded';
    selectBtn.style.borderColor = 'greenyellow';
    panelTitle.style.display = 'none';
  }

  audioPlayer.addEventListener('timeupdate', function () {
    if (audioPlayer.duration) {
      fabTimeLabel.textContent = formatTime(audioPlayer.currentTime);
      fabTimeLabel.style.display = 'block';
    }
  });

  // Expose so page scripts can call it
  window.lpcPlayer = {
    get handle() { return cachedHandle; },
    get audio() { return audioPlayer; },
    get fileMap() { return window.fileMap; },
    isLoaded: function () { return Object.keys(window.fileMap).length > 0; },

    // Load a specific track from the stored directory handle
    async loadTrack(albumUsbDir, usbFilename) {
      if (!cachedHandle) return false;
      try {
        const perm = await cachedHandle.queryPermission({ mode: 'read' });
        let handle = cachedHandle;
        if (perm !== 'granted') {
          const granted = await cachedHandle.requestPermission({ mode: 'read' });
          if (granted !== 'granted') return false;
        }
        const albumDir = await handle.getDirectoryHandle(albumUsbDir);
        const fileHandle = await albumDir.getFileHandle(usbFilename);
        const file = await fileHandle.getFile();
        audioPlayer.src = URL.createObjectURL(file);
        audioPlayer.style.display = '';
        markLoaded();
        return true;
      } catch (e) {
        console.warn('lpcPlayer.loadTrack failed:', e);
        return false;
      }
    },

    // Traverse entire directory into window.fileMap (for subtitles search)
    async traverseAll() {
      if (!cachedHandle) return false;
      try {
        const perm = await cachedHandle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') return false;
        window.fileMap = {};
        await traverseDir(cachedHandle, 'LPC USB');
        audioPlayer.style.display = '';
        markLoaded();
        return true;
      } catch (e) {
        console.warn('lpcPlayer.traverseAll failed:', e);
        return false;
      }
    }
  };

  async function traverseDir(dirHandle, path) {
    for await (const [name, entry] of dirHandle.entries()) {
      const entryPath = path + '/' + name;
      if (entry.kind === 'file' && name.toLowerCase().endsWith('.mp3')) {
        const file = await entry.getFile();
        window.fileMap[entryPath] = URL.createObjectURL(file);
      } else if (entry.kind === 'directory') {
        await traverseDir(entry, entryPath);
      }
    }
  }

  // ── FAB toggle ───────────────────────────────────────────────────────────────
  fab.addEventListener('click', async function () {
    const isOpen = fabPanel.style.display === 'flex';
    fabPanel.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen && cachedHandle && audioPlayer.style.display === 'none') {
      try {
        const perm = await cachedHandle.requestPermission({ mode: 'read' });
        if (perm === 'granted') {
          // Let the current page's init handle what to load
          document.dispatchEvent(new CustomEvent('lpc-permission-granted'));
        }
      } catch (e) {
        console.warn('FAB permission request failed:', e);
      }
    }
  });

  // Close panel on outside click (but not search results)
  document.addEventListener('click', function (e) {
    const searchResults = document.getElementById('subtitles-search-results');
    if (!fab.contains(e.target) && !fabPanel.contains(e.target) &&
        !(searchResults && searchResults.contains(e.target))) {
      fabPanel.style.display = 'none';
    }
  });

  // ── Select button ────────────────────────────────────────────────────────────
  selectBtn.addEventListener('click', async function () {
    if (!('showDirectoryPicker' in window)) return;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read', startIn: 'music' });
      await storeHandle(dirHandle);
      cachedHandle = dirHandle;
      window.fileMap = {};
      selectBtn.textContent = '⏳ Loading…';
      selectBtn.disabled = true;
      await traverseDir(dirHandle, 'LPC USB');
      selectBtn.disabled = false;
      markLoaded();
      document.dispatchEvent(new CustomEvent('lpc-loaded'));
    } catch (e) {
      selectBtn.disabled = false;
      if (e.name !== 'AbortError') console.error(e);
    }
  });

  // ── Auto-load on startup ─────────────────────────────────────────────────────
  getStoredHandle().then(async function (h) {
    cachedHandle = h;
    if (!h) return;
    try {
      const perm = await h.queryPermission({ mode: 'read' });
      if (perm === 'granted') {
        await traverseDir(h, 'LPC USB');
        markLoaded();
        document.dispatchEvent(new CustomEvent('lpc-loaded'));
      }
    } catch (e) {
      console.warn('Auto-load on startup failed:', e);
    }
  });

  // ── Soft navigation ──────────────────────────────────────────────────────────
  // Intercept same-origin link clicks and swap only <main> content.
  // The FAB and audio element stay alive so playback continues.

  const MAIN_SEL = 'main.page-content';

  // Persistent record of external script URLs that have been executed at least once.
  // DOM queries alone can't catch scripts removed by previous innerHTML swaps, so we
  // track them here in the closure across all soft-navigations.
  const _executedScriptSrcs = new Set(
    Array.from(document.querySelectorAll('script[src]')).map(function (s) {
      return new URL(s.src, location.href).href;
    })
  );

  function isSameOriginLink(a) {
    return a.hostname === location.hostname &&
           !a.hasAttribute('target') &&
           !a.hasAttribute('download') &&
           (a.protocol === 'http:' || a.protocol === 'https:');
  }

  async function softNavigate(url) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) { location.href = url; return; }
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const newMain = doc.querySelector(MAIN_SEL);
      const oldMain = document.querySelector(MAIN_SEL);
      if (!newMain || !oldMain) { location.href = url; return; }

      // Swap title
      document.title = doc.title;

      // Swap main content
      oldMain.innerHTML = newMain.innerHTML;

      // Update URL
      history.pushState({ url }, doc.title, url);

      // Re-run script tags in the new content.
      // Use the persistent _executedScriptSrcs set so scripts removed from the DOM
      // by previous innerHTML swaps are still recognised as already executed.
      oldMain.querySelectorAll('script').forEach(function (orig) {
        if (orig.src) {
          const abs = new URL(orig.src, location.href).href;
          if (_executedScriptSrcs.has(abs)) return; // already ran — skip
          _executedScriptSrcs.add(abs);             // mark as executed
        }
        const s = document.createElement('script');
        Array.from(orig.attributes).forEach(function (a) { s.setAttribute(a.name, a.value); });
        if (!orig.src) s.textContent = orig.textContent;
        orig.parentNode.replaceChild(s, orig);
      });

      // Scroll to top
      window.scrollTo(0, 0);

      // Notify page scripts that the page changed
      document.dispatchEvent(new CustomEvent('soft-nav', { detail: { url } }));
    } catch (e) {
      console.warn('Soft nav failed, doing hard nav:', e);
      location.href = url;
    }
  }

  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a || !isSameOriginLink(a)) return;
    const url = a.href;
    // Skip anchor-only links
    try {
      const u = new URL(url);
      if (u.pathname === location.pathname && u.hash) return;
    } catch (_) { return; }
    e.preventDefault();
    softNavigate(url);
  });

  window.addEventListener('popstate', function (e) {
    softNavigate(location.href);
  });

})();
