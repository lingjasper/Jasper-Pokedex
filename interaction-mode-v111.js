(() => {
  'use strict';
  const isMobile = () => window.matchMedia('(max-width:640px)').matches;
  const isBulkMode = () => document.getElementById('bulkModeToggle')?.checked === true;
  const clearPokedexSelection = () => {
    document.querySelectorAll('.pokemon-card.pokedex-active').forEach(card => card.classList.remove('pokedex-active'));
    const side = document.getElementById('desktopRightSidebar');
    const panel = document.getElementById('pokedexDetailPanel');
    if (panel) panel.hidden = true;
    if (side && !panel) side.innerHTML = '';
    window.JASPER_POKEDEX_DETAIL = null;
    window.JASPER_POKEDEX_UI?.close?.();
  };
  let savedSyncState = null;

  const installSyncGuard = () => {
    if (window.__JASPER_V111_SYNC_GUARD__) return;
    const native = window.JASPER_SYNC_SET_PILL;
    if (typeof native !== 'function') return;
    window.__JASPER_V111_SYNC_GUARD__ = true;
    window.JASPER_SYNC_SET_PILL = (label, type) => {
      if (isBulkMode() && type === 'bulk' && savedSyncState) return native(savedSyncState.label, savedSyncState.type);
      return native(label, type);
    };
  };

  const rememberSyncState = () => {
    const pill = document.getElementById('githubSyncPill');
    if (!pill) return;
    savedSyncState = {
      label: pill.querySelector('.github-sync-label')?.textContent || 'Token Sync',
      type: pill.dataset.state || 'normal'
    };
  };

  const installStyles = () => {
    if (document.getElementById('jasperV111InteractionStyles')) return;
    const style = document.createElement('style');
    style.id = 'jasperV111InteractionStyles';
    style.textContent = `
      /* v1.1.1 — normal mode inspects; Bulk Mode edits. */
      .pokemon-card .pokedex-button,
      body > .pokedex-button-overlay { display:none!important; pointer-events:none!important; }
      #bulkModeSection { flex:0 0 auto; margin:0!important; padding:0!important; }
      #bulkModeSection .bulk-separator { display:none!important; }
      #bulkModeSection .bulk-toggle-row { display:flex; align-items:center; gap:8px; cursor:pointer; }
      #bulkModeSection .bulk-toggle-row > span { display:none!important; }
      #bulkModeSection .bulk-toggle-row::before { content:''; display:inline-flex; align-items:center; justify-content:center; width:34px; min-width:34px; height:34px; min-height:34px; box-sizing:border-box; padding:0; border:1px solid var(--color-border,#cbd5e1); border-radius:999px; background-color:var(--color-surface-elevated,#fff); background-image:url('Icons/pokeball.svg'); background-repeat:no-repeat; background-position:center; background-size:20px 20px; color:var(--color-text-primary,#475569); box-shadow:0 2px 8px var(--color-shadow,rgba(15,23,42,.08)); }
      #bulkModeToggle { position:absolute; opacity:0; width:1px; height:1px; pointer-events:none; }
      #bulkModeSection:has(#bulkModeToggle:checked) .bulk-toggle-row::before { border-color:var(--color-accent,#5b9cff); background-color:var(--color-selection,#eff6ff); }
      #bulkPendingCount { display:none!important; }
      #desktopWorkspaceTop #bulkModeSection { position:relative; }
      #bulkActions .bulk-banner-icon { content:url('Icons/pokeball.svg'); }
      @keyframes jasperBulkPokemonJumpDesktop {
        0%,100% { translate:0 0; }
        50% { translate:0 -2px; }
      }
      @keyframes jasperBulkPokemonJumpMobile {
        0%,100% { translate:0 0; }
        50% { translate:0 -1px; }
      }
      body.jasper-bulk-mode .pokemon-card .pokemon-sprite { animation:jasperBulkPokemonJumpDesktop .333s steps(2,end) infinite!important; }
      @media (max-width:640px) {
        #mobileHeader #bulkModeSection { position:relative; }
        #mobileHeader #mobileHeaderActions { gap:8px; }
        body.jasper-bulk-mode .pokemon-card .pokemon-sprite { animation:jasperBulkPokemonJumpMobile .333s steps(2,end) infinite!important; }
      }
      @media (prefers-reduced-motion: reduce) {
        body.jasper-bulk-mode .pokemon-card .pokemon-sprite { animation:none!important; }
      }
    `;
    document.head.appendChild(style);
  };

  const placeBulk = () => {
    const section = document.getElementById('bulkModeSection');
    if (!section) return false;
    const target = isMobile()
      ? document.querySelector('#mobileHeader #mobileHeaderActions')
      : document.getElementById('desktopWorkspaceTop');
    if (!target) return false;
    const sync = document.getElementById('githubSyncWrap');
    if (section.parentElement !== target) {
      if (sync && sync.parentElement === target) target.insertBefore(section, sync);
      else target.appendChild(section);
    } else if (sync && sync.parentElement === target && section.nextElementSibling !== sync) {
      target.insertBefore(section, sync);
    }
    return true;
  };

  const applyModeState = () => {
    const active = isBulkMode();
    document.documentElement.classList.toggle('jasper-bulk-mode', active);
    document.body?.classList.toggle('jasper-bulk-mode', active);
    const section = document.getElementById('bulkModeSection');
    if (section) section.setAttribute('aria-label', active ? 'Manage PC active — storage editing enabled' : 'Manage PC — storage editing disabled');
  };

  const openFromEntry = entry => {
    if (!entry || entry.classList.contains('empty') || isBulkMode()) return;
    const activeCard = document.querySelector('#boxContainer .pokemon-card.pokedex-active');
    const sameCard = entry.classList.contains('pokemon-card') && entry === activeCard;
    if (sameCard) {
      clearPokedexSelection();
      return;
    }
    clearPokedexSelection();
    if (entry.classList.contains('pokemon-card')) entry.classList.add('pokedex-active');
    window.JASPER_POKEDEX_UI?.open?.(entry);
  };

  const installInteraction = () => {
    if (document.documentElement.dataset.jasperV111InteractionBound === 'true') return;
    document.documentElement.dataset.jasperV111InteractionBound = 'true';
    document.addEventListener('click', event => {
      const toggle = event.target.closest('#bulkModeToggle');
      if (toggle) {
        if (toggle.checked) rememberSyncState(), clearPokedexSelection();
        else savedSyncState = null;
        setTimeout(() => { applyModeState(); placeBulk(); }, 0);
        return;
      }
      if (event.target.closest('.search-jump')) return;
      const entry = event.target.closest('#boxContainer .pokemon-card:not(.empty),#boxContainer .cell[data-id]:not(.empty),#listContainer .list-row[data-id],#searchResults .search-result-item[data-id]');
      if (!entry || isBulkMode()) return;
      event.preventDefault();
      event.stopPropagation();
      openFromEntry(entry);
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const entry = event.target.closest?.('#boxContainer .pokemon-card:not(.empty),#listContainer .list-row[data-id],#searchResults .search-result-item[data-id]');
      if (!entry || isBulkMode() || event.target.closest('.search-jump')) return;
      event.preventDefault();
      event.stopPropagation();
      openFromEntry(entry);
    }, true);
    document.addEventListener('change', event => {
      if (event.target.id === 'bulkModeToggle') {
        if (event.target.checked) rememberSyncState(), clearPokedexSelection();
        else savedSyncState = null;
        setTimeout(() => { applyModeState(); placeBulk(); }, 0);
      }
    }, true);
  };

  const observeUI = () => {
    const sync = () => { installStyles(); placeBulk(); applyModeState(); };
    sync();
    new MutationObserver(sync).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', sync, { passive:true });
    window.addEventListener('jasper:sync-ui-ready', sync);
    window.addEventListener('jasper:pokedex-game-changed', () => { clearPokedexSelection(); setTimeout(sync, 0); });
  };

  window.JASPER_COLLECTION_MODE = { isBulk: isBulkMode, open: openFromEntry, closePokedex: clearPokedexSelection };
  const start = () => { installStyles(); installSyncGuard(); installInteraction(); observeUI(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();