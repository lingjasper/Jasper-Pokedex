(() => {
  'use strict';

  // Legacy GitHub sync layer retained for compatibility. Release moniker is
  // explicitly synchronized with the current release so old cached scripts
  // cannot restore a previous version label.
  const BASE = 'beta071-base.js?v=0.10.3';
  const BETA_LABEL = 'Beta v0.10.3';
  const TOKEN_KEY = 'jasper_pokedex_github_token';
  const SHA_KEY = 'jasper_pokedex_save_sha';
  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const LAST_SYNC_KEY = 'jasper_pokedex_last_synced_at';
  const API = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex';
  const TOTAL_DEX = 300;
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const state = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch { return {}; } };

  const setMoniker = () => {
    document.querySelectorAll('#pokedexBetaMoniker,.desktop-sidebar-brand .beta').forEach(el => el.textContent = BETA_LABEL);
  };

  // The remainder of the legacy sync implementation is loaded from the
  // existing base layer. This wrapper intentionally does not own rendering,
  // search, forms, boxes, or Jump-to behavior anymore.
  const loadBase = () => {
    const script = document.createElement('script');
    script.src = BASE;
    script.onload = () => { setMoniker(); };
    script.onerror = () => { setMoniker(); };
    document.head.appendChild(script);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { setMoniker(); loadBase(); }, { once: true });
  else { setMoniker(); loadBase(); }
})();
