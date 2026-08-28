(() => {
  'use strict';

  /* Beta v0.13.5.3 bug fixes.
   * This layer owns only two presentation safeguards:
   * 1) Desktop workspace title must exist independently of Sync/token state.
   * 2) Bulk Mode is available only while a GitHub token is active.
   * It does not own Pokémon data, rendering, Sync, or icon artwork. */

  const TOKEN_KEY = 'jasper_pokedex_github_token';
  let lastToken = null;
  let tokenPoll = null;

  const hasToken = () => !!localStorage.getItem(TOKEN_KEY);

  const ensureDesktopTitle = () => {
    const workspace = document.getElementById('desktopWorkspace');
    if (!workspace) return;
    let title = document.getElementById('desktopWorkspaceTitle');
    if (title) return;
    const banner = document.getElementById('dexProgressBanner');
    title = document.createElement('h1');
    title.id = 'desktopWorkspaceTitle';
    title.textContent = window.JASPER_ACTIVE_GAME === 'AlphaSapphire'
      ? 'Pokémon Alpha Sapphire'
      : window.JASPER_ACTIVE_GAME === 'Sun'
        ? 'Pokémon Sun'
        : 'Pokémon White 2';
    title.setAttribute('aria-live', 'polite');
    workspace.insertBefore(title, banner || workspace.firstChild);
  };

  const setBulkAvailability = active => {
    const toggle = document.getElementById('bulkModeToggle');
    if (!toggle) return;
    if (!active && toggle.checked) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
    toggle.disabled = !active;
    toggle.setAttribute('aria-disabled', String(!active));
    const row = toggle.closest('.bulk-toggle-row');
    if (row) row.classList.toggle('bulk-disabled', !active);
  };

  const syncBulkAvailability = () => {
    const active = hasToken();
    if (active === lastToken) {
      setBulkAvailability(active);
      return;
    }
    lastToken = active;
    setBulkAvailability(active);
  };

  const boot = () => {
    ensureDesktopTitle();
    syncBulkAvailability();

    const observer = new MutationObserver(() => {
      ensureDesktopTitle();
      setBulkAvailability(hasToken());
    });
    observer.observe(document.body, { childList: true, subtree: true });

    tokenPoll = window.setInterval(syncBulkAvailability, 250);
    window.addEventListener('beforeunload', () => window.clearInterval(tokenPoll), { once: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
