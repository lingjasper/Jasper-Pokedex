(() => {
  'use strict';

  const BASE = 'beta071-base.js';
  const TOKEN_KEY = 'jasper_pokedex_github_token';
  const SHA_KEY = 'jasper_pokedex_save_sha';
  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const LAST_SYNC_KEY = 'jasper_pokedex_last_synced_at';
  const API = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex';
  const TOTAL_DEX = 300;

  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const state = () => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch { return {}; }
  };
  const b64decode = value => {
    const binary = atob(value.replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };
  const request = async (url, options = {}) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.headers || {})
    };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(url, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || `GitHub API error ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  };

  const setPill = (label, type) => {
    const pill = document.getElementById('githubSyncPill');
    const icon = document.getElementById('githubSyncIcon');
    const text = pill?.querySelector('.github-sync-label');
    if (text) text.textContent = label;
    if (pill) pill.dataset.state = type;
    if (icon) {
      icon.className = `github-sync-icon ${type === 'busy' ? 'spinning' : ''}`;
      icon.textContent = type === 'ok' ? '✓' : type === 'busy' ? '↻' : type === 'warning' ? '!' : '×';
    }
  };

  const setStatus = (text, type = 'normal') => {
    const status = document.getElementById('githubSyncStatus');
    if (status) {
      status.textContent = text;
      status.dataset.type = type;
    }
    setPill(type === 'ok' ? 'Synced' : type === 'busy' ? 'Syncing...' : type === 'error' ? 'Sync Error' : token() ? 'Synced' : 'Token Sync', type === 'error' ? 'warning' : type);
  };

  const formatLastSync = value => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `Last modified on ${date.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    }).replace(' AM', 'am').replace(' PM', 'pm')}.`;
  };

  const updateLastSync = value => {
    if (value) localStorage.setItem(LAST_SYNC_KEY, value);
    const el = document.getElementById('githubLastSynced');
    if (el) el.textContent = formatLastSync(value || localStorage.getItem(LAST_SYNC_KEY));
  };

  const setTokenUI = active => {
    const input = document.getElementById('githubTokenInput');
    const activate = document.getElementById('githubConnectBtn');
    const change = document.getElementById('githubChangeTokenBtn');
    if (!input) return;
    if (active) {
      input.type = 'text';
      input.value = '****************';
      input.disabled = true;
      if (activate) activate.hidden = true;
      if (change) change.hidden = false;
    } else {
      input.type = 'password';
      input.value = '';
      input.disabled = false;
      if (activate) activate.hidden = false;
      if (change) change.hidden = true;
    }
  };

  const updateBanner = () => {
    const banner = document.getElementById('dexProgressBanner');
    if (!banner) return;
    const saved = state();
    const cells = [...document.querySelectorAll('#boxContainer .cell:not(.empty)')];
    const registered = Math.min(TOTAL_DEX, cells.filter(cell => !!saved[cell.dataset.id]).length);
    const text = banner.querySelector('.dex-progress-text');
    if (text) text.textContent = `${registered} of ${TOTAL_DEX} Pokémon registered · ${TOTAL_DEX - registered} remaining · ${Math.round(registered / TOTAL_DEX * 100)}% complete`;
  };

  const loadRemote = async () => {
    if (!token()) return;
    setStatus('Loading from GitHub...', 'busy');
    try {
      const file = await request(`${API}/contents/save.json?ref=main`);
      const payload = JSON.parse(b64decode(file.content));
      localStorage.setItem(SHA_KEY, file.sha);
      localStorage.setItem(STATE_KEY, JSON.stringify(payload.pokemon || {}));
      updateLastSync(payload.updatedAt || null);
      setTokenUI(true);
      setStatus('Synced', 'ok');
      updateBanner();
    } catch (error) {
      if (error.status === 404) {
        setTokenUI(true);
        setStatus('Connected — save will be created on your next change.', 'ok');
        updateLastSync();
      } else if (error.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SHA_KEY);
        setTokenUI(false);
        setStatus('GitHub token is invalid or expired.', 'error');
      } else {
        setStatus(`Could not load GitHub save: ${error.message}`, 'error');
      }
    }
  };

  const connect = async () => {
    const input = document.getElementById('githubTokenInput');
    const value = input?.value.trim();
    if (!value || value === '****************') return;
    localStorage.setItem(TOKEN_KEY, value);
    setStatus('Verifying GitHub token...', 'busy');
    try {
      await request(`${API}/contents/save.json?ref=main`);
      localStorage.removeItem(SHA_KEY);
      setTokenUI(true);
      await loadRemote();
    } catch (error) {
      if (error.status === 404) {
        localStorage.removeItem(SHA_KEY);
        setTokenUI(true);
        setStatus('Connected — save will be created on your next change.', 'ok');
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SHA_KEY);
        setTokenUI(false);
        setStatus(error.status === 401 ? 'GitHub token is invalid or expired.' : `Connection failed: ${error.message}`, 'error');
      }
    }
  };

  const installDesktopSyncUI = () => {
    if (isMobile()) return;

    const top = document.getElementById('desktopWorkspaceTop');
    const workspace = document.getElementById('desktopWorkspace');
    const table = document.getElementById('desktopTableContainer');
    if (!top || !workspace || !table) return;

    let wrap = document.getElementById('githubSyncWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'githubSyncWrap';
      wrap.innerHTML = `
        <button id="githubSyncPill" type="button" data-state="normal" aria-expanded="false">
          <span id="githubSyncIcon" class="github-sync-icon">×</span>
          <span class="github-sync-label">Token Sync</span>
          <span class="github-sync-chevron" aria-hidden="true"></span>
        </button>
        <div id="githubSyncMenu" role="menu">
          <div id="githubSyncStatus">Not connected — enter a GitHub token to sync.</div>
          <div id="githubLastSynced"></div>
          <div id="githubSyncControls">
            <input id="githubTokenInput" type="password" autocomplete="off" placeholder="GitHub token">
            <button id="githubConnectBtn" type="button">Activate Token</button>
            <button id="githubChangeTokenBtn" type="button" hidden>Change Token</button>
          </div>
          <p id="githubSyncNote">Your token stays in this browser and is never committed to GitHub.</p>
        </div>`;
      top.appendChild(wrap);

      document.getElementById('githubSyncPill').addEventListener('click', event => {
        event.stopPropagation();
        const open = wrap.classList.toggle('open');
        document.getElementById('githubSyncPill').setAttribute('aria-expanded', String(open));
        updateLastSync();
      });
      document.getElementById('githubConnectBtn').addEventListener('click', connect);
      document.getElementById('githubChangeTokenBtn').addEventListener('click', () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SHA_KEY);
        setTokenUI(false);
        setStatus('Enter a new GitHub token to activate sync.');
      });
      document.addEventListener('click', event => {
        if (!wrap.contains(event.target)) wrap.classList.remove('open');
      });
    } else if (wrap.parentElement !== top) {
      top.appendChild(wrap);
    }

    let banner = document.getElementById('dexProgressBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dexProgressBanner';
      banner.innerHTML = '<span class="dex-progress-icon">i</span><span class="dex-progress-text"></span>';
      workspace.insertBefore(banner, table);
    } else if (banner.parentElement !== workspace) {
      workspace.insertBefore(banner, table);
    }

    const main = document.querySelector('.main-content');
    const controls = document.querySelector('.controls-container');
    if (main && controls && table.contains(main)) {
      let separator = table.querySelector('.desktop-controls-separator');
      if (!separator) {
        separator = document.createElement('div');
        separator.className = 'desktop-controls-separator';
        controls.insertAdjacentElement('afterend', separator);
      }
    }

    const sidebar = document.getElementById('desktopSidebar');
    if (sidebar) {
      const subheader = sidebar.querySelector('.desktop-sidebar-subheader');
      if (subheader) {
        subheader.textContent = 'Titles';
        subheader.style.textTransform = 'none';
      }
    }

    const setViewLabel = (id, label) => {
      const button = document.getElementById(id);
      if (!button) return;
      [...button.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
      button.appendChild(document.createTextNode(` ${label}`));
    };
    setViewLabel('boxViewBtn', 'Box view');
    setViewLabel('listViewBtn', 'List view');

    if (banner) updateBanner();
    if (token()) {
      setTokenUI(true);
      updateLastSync();
      if (!sessionStorage.getItem('jasper_pokedex_desktop_loaded')) {
        sessionStorage.setItem('jasper_pokedex_desktop_loaded', '1');
        loadRemote();
      }
    } else {
      setPill('Token Sync', 'normal');
    }

    const cells = document.getElementById('boxContainer');
    if (cells && !cells.dataset.beta082Observed) {
      cells.dataset.beta082Observed = '1';
      new MutationObserver(updateBanner).observe(cells, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  };

  const injectFixStyles = () => {
    if (document.getElementById('beta082Styles')) return;
    const style = document.createElement('style');
    style.id = 'beta082Styles';
    style.textContent = `
      @media(min-width:641px){
        .desktop-sidebar-subheader{text-transform:none!important;letter-spacing:0!important;font-size:.82rem!important;font-weight:700!important}
        #desktopWorkspaceTop #githubSyncWrap{display:block!important;visibility:visible!important;opacity:1!important;z-index:20000!important}
        #githubSyncPill{position:relative;z-index:20001}
        #githubSyncMenu{z-index:20002!important}
        #desktopWorkspace #dexProgressBanner{display:flex!important;visibility:visible!important;opacity:1!important;position:relative;z-index:12000}
        .desktop-controls-separator{height:0;border-top:1px solid #e2e8f0;margin:0 0 16px;flex:0 0 auto}
        #desktopTableContainer .desktop-controls-separator{width:100%}
      }
    `;
    document.head.appendChild(style);
  };

  const repair = () => {
    if (isMobile()) return;
    injectFixStyles();
    installDesktopSyncUI();
  };

  const loadBase = () => {
    const script = document.createElement('script');
    script.src = BASE;
    script.onload = () => {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', repair, { once: true });
      else setTimeout(repair, 0);
    };
    document.head.appendChild(script);
  };

  loadBase();
})();
