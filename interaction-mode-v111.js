(() => {
  'use strict';
  const isMobile = () => window.matchMedia('(max-width:640px)').matches;
  const isBulkMode = () => document.getElementById('bulkModeToggle')?.checked === true;
  const clearPokedexSelection = () => {
    document.querySelectorAll('.pokemon-card.pokedex-active').forEach(card => card.classList.remove('pokedex-active'));
    const side = document.getElementById('desktopRightSidebar');
    const panel = document.getElementById('pokedexDetailPanel');
    const sheet = document.getElementById('mobilePokedexSheet');
    const backdrop = document.getElementById('mobilePokedexBackdrop');
    if (panel) panel.hidden = true;
    if (side && !panel) side.innerHTML = '';
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('mobile-pokedex-open');
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
    savedSyncState = { label: pill.querySelector('.github-sync-label')?.textContent || 'Token Sync', type: pill.dataset.state || 'normal' };
  };

  const installMobilePokedexSheet = () => {
    if (!isMobile() || document.getElementById('mobilePokedexSheet')) return;
    const host = document.getElementById('desktopRightSidebar') || document.body.appendChild(Object.assign(document.createElement('aside'), { id:'desktopRightSidebar' }));
    host.style.display = 'none';
    host.setAttribute('aria-hidden', 'true');

    const backdrop = document.createElement('div');
    backdrop.id = 'mobilePokedexBackdrop';
    backdrop.hidden = true;
    backdrop.addEventListener('click', clearPokedexSelection);

    const sheet = document.createElement('section');
    sheet.id = 'mobilePokedexSheet';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Pokédex details');
    sheet.innerHTML = '<div class="mobile-pokedex-sheet-header"><span class="mobile-pokedex-sheet-handle" aria-hidden="true"></span><button class="mobile-pokedex-sheet-close" type="button" aria-label="Close Pokédex details">×</button></div><div class="mobile-pokedex-sheet-content"></div>';
    sheet.querySelector('.mobile-pokedex-sheet-close').addEventListener('click', clearPokedexSelection);
    document.body.append(backdrop, sheet);

    const syncSheet = () => {
      const content = sheet.querySelector('.mobile-pokedex-sheet-content');
      if (!content || !host.innerHTML) return;
      const next = host.innerHTML;
      if (content.innerHTML !== next) content.innerHTML = next;
      sheet.hidden = false;
      backdrop.hidden = false;
      document.body.classList.add('mobile-pokedex-open');
    };
    new MutationObserver(syncSheet).observe(host, { childList:true, subtree:true });
    window.JASPER_SYNC_MOBILE_POKEDEX = syncSheet;
  };

  const installStyles = () => {
    if (document.getElementById('jasperV111InteractionStyles')) return;
    const style = document.createElement('style');
    style.id = 'jasperV111InteractionStyles';
    style.textContent = `
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
      @keyframes jasperBulkPokemonJumpDesktop { 0%,100% { translate:0 0; } 50% { translate:0 -2px; } }
      @keyframes jasperBulkPokemonJumpMobile { 0%,100% { translate:0 0; } 50% { translate:0 -1px; } }
      body.jasper-bulk-mode .pokemon-card .pokemon-sprite { animation:jasperBulkPokemonJumpDesktop .333s steps(2,end) infinite!important; }
      @media (max-width:640px) {
        #mobileHeader #bulkModeSection { position:relative; }
        #mobileHeader #mobileHeaderActions { gap:8px; }
        body.jasper-bulk-mode .pokemon-card .pokemon-sprite { animation:jasperBulkPokemonJumpMobile .333s steps(2,end) infinite!important; }
        html[data-theme="dark"] #mobileHeader #bulkModeSection .bulk-toggle-row::before { border-color:#343A46; background-color:#242831; box-shadow:0 2px 8px rgba(0,0,0,.32); }
        html[data-theme="dark"] #mobileHeader #bulkModeSection:has(#bulkModeToggle:checked) .bulk-toggle-row::before { border-color:#4979B6; background-color:#1D3150; }
        #mobilePokedexBackdrop { position:fixed; inset:0; background:rgba(15,23,42,.38); z-index:12900; }
        #mobilePokedexSheet { position:fixed; left:0; right:0; bottom:0; z-index:13000; display:flex; flex-direction:column; width:100%; height:820px; min-height:820px; max-height:820px; box-sizing:border-box; overflow:hidden; background:var(--color-surface,#fff); color:var(--color-text-primary,#0f172a); border:1px solid var(--color-border-strong,#cbd5e1); border-bottom:0; border-radius:16px 16px 0 0; box-shadow:0 -8px 28px var(--color-shadow,rgba(15,23,42,.16)); }
        #mobilePokedexSheet[hidden],#mobilePokedexBackdrop[hidden] { display:none!important; }
        .mobile-pokedex-sheet-header { position:relative; display:flex; align-items:center; justify-content:center; flex:0 0 42px; padding:6px 12px; box-sizing:border-box; border-bottom:1px solid var(--color-separator,#e5e7eb); }
        .mobile-pokedex-sheet-handle { width:36px; height:4px; border-radius:999px; background:var(--color-border-strong,#cbd5e1); }
        .mobile-pokedex-sheet-close { position:absolute; top:5px; right:8px; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; padding:0; border:1px solid var(--color-border,#e2e8f0); border-radius:999px; background:var(--color-surface-elevated,#fff); color:var(--color-text-secondary,#475569); font:400 24px/1 sans-serif; cursor:pointer; }
        .mobile-pokedex-sheet-close:hover { background:var(--color-selection,#dbeafe); color:var(--color-text-primary,#0f172a); }
        .mobile-pokedex-sheet-content { min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:14px 12px 24px; box-sizing:border-box; }
        .mobile-pokedex-sheet-content .jasper-api-pokedex { display:flex; flex-direction:column; gap:14px; min-height:0; }
        .mobile-pokedex-sheet-content .jasper-api-pokedex-title { margin:0; font-size:22px; line-height:1.2; font-weight:700; color:inherit; }
        .mobile-pokedex-sheet-content .jasper-api-pokedex-subtitle { margin:-7px 0 0; font-size:12px; opacity:.65; }
        .mobile-pokedex-sheet-content .jasper-api-card { border:1px solid rgba(100,116,139,.28); border-radius:8px; padding:12px; background:rgba(148,163,184,.06); }
        .mobile-pokedex-sheet-content .jasper-api-card h2 { margin:0 0 9px; font-size:14px; line-height:1.2; font-weight:700; }
        .mobile-pokedex-sheet-content .jasper-api-card p { margin:0; font-size:13px; line-height:1.45; }
        .mobile-pokedex-sheet-content .jasper-api-row { display:flex; justify-content:space-between; gap:12px; padding:5px 0; font-size:13px; }
        .mobile-pokedex-sheet-content .jasper-api-row+.jasper-api-row { border-top:1px solid rgba(100,116,139,.16); }
        .mobile-pokedex-sheet-content .jasper-api-label { opacity:.7; }
        .mobile-pokedex-sheet-content .jasper-api-value { text-align:right; font-weight:600; }
        .mobile-pokedex-sheet-content .jasper-api-card ul { margin:5px 0 0; padding-left:17px; font-size:12px; line-height:1.5; }
        .mobile-pokedex-sheet-content .jasper-api-card li+li { margin-top:4px; }
        .mobile-pokedex-sheet-content .jasper-api-list-label { margin-top:9px; font-size:12px; font-weight:700; }

        /* Mobile Pokédex Sheet Dark SOT mirrors the Desktop Right Sidebar theme. */
        html[data-theme="dark"] #mobilePokedexBackdrop { background:rgba(0,0,0,.52); }
        html[data-theme="dark"] #mobilePokedexSheet { background:#181a20; color:#f5f7fa; border-color:#454c59; box-shadow:0 -8px 28px rgba(0,0,0,.32); }
        html[data-theme="dark"] .mobile-pokedex-sheet-header { border-bottom-color:#303640; }
        html[data-theme="dark"] .mobile-pokedex-sheet-handle { background:#454c59; }
        html[data-theme="dark"] .mobile-pokedex-sheet-close { border-color:#454c59; background:#242831; color:#c5cad3; }
        html[data-theme="dark"] .mobile-pokedex-sheet-close:hover { background:#203b63; color:#f5f7fa; }
        html[data-theme="dark"] .mobile-pokedex-sheet-content .jasper-api-card { border-color:rgba(100,116,139,.28); background:rgba(148,163,184,.04); }
        html[data-theme="dark"] .mobile-pokedex-sheet-content .jasper-api-row+.jasper-api-row { border-top-color:rgba(100,116,139,.16); }
      }
      @media (prefers-reduced-motion: reduce) { body.jasper-bulk-mode .pokemon-card .pokemon-sprite { animation:none!important; } }
    `;
    document.head.appendChild(style);
  };

  const placeBulk = () => {
    const section = document.getElementById('bulkModeSection');
    if (!section) return false;
    const target = isMobile() ? document.querySelector('#mobileHeader #mobileHeaderActions') : document.getElementById('desktopWorkspaceTop');
    if (!target) return false;
    const sync = document.getElementById('githubSyncWrap');
    if (section.parentElement !== target) {
      if (sync && sync.parentElement === target) target.insertBefore(section, sync);
      else target.appendChild(section);
    } else if (sync && sync.parentElement === target && section.nextElementSibling !== sync) target.insertBefore(section, sync);
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
    if (sameCard) { clearPokedexSelection(); return; }
    clearPokedexSelection();
    if (entry.classList.contains('pokemon-card')) entry.classList.add('pokedex-active');
    window.JASPER_POKEDEX_UI?.open?.(entry);
    if (isMobile()) setTimeout(() => window.JASPER_SYNC_MOBILE_POKEDEX?.(), 0);
  };

  const installInteraction = () => {
    if (document.documentElement.dataset.jasperV111InteractionBound === 'true') return;
    document.documentElement.dataset.jasperV111InteractionBound = 'true';
    document.addEventListener('click', event => {
      const toggle = event.target.closest('#bulkModeToggle');
      if (toggle) { if (toggle.checked) rememberSyncState(), clearPokedexSelection(); else savedSyncState = null; setTimeout(() => { applyModeState(); placeBulk(); }, 0); return; }
      if (event.target.closest('.search-jump')) return;
      const entry = event.target.closest('#boxContainer .pokemon-card:not(.empty),#boxContainer .cell[data-id]:not(.empty),#listContainer .list-row[data-id],#searchResults .search-result-item[data-id]');
      if (!entry || isBulkMode()) return;
      event.preventDefault(); event.stopPropagation(); openFromEntry(entry);
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const entry = event.target.closest?.('#boxContainer .pokemon-card:not(.empty),#listContainer .list-row[data-id],#searchResults .search-result-item[data-id]');
      if (!entry || isBulkMode() || event.target.closest('.search-jump')) return;
      event.preventDefault(); event.stopPropagation(); openFromEntry(entry);
    }, true);
    document.addEventListener('change', event => {
      if (event.target.id === 'bulkModeToggle') { if (event.target.checked) rememberSyncState(), clearPokedexSelection(); else savedSyncState = null; setTimeout(() => { applyModeState(); placeBulk(); }, 0); }
    }, true);
  };

  const observeUI = () => {
    const sync = () => { installStyles(); installMobilePokedexSheet(); placeBulk(); applyModeState(); };
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