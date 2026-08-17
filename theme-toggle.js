(function () {
  const STORAGE_KEY = 'jasper-pokedex-theme';

  function isDesktop() {
    return window.matchMedia('(min-width: 769px)').matches;
  }

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.themePreference = theme;
    root.dataset.theme = isDesktop() && theme === 'dark' ? 'dark' : 'light';
  }

  function installToggle() {
    if (!isDesktop() || document.getElementById('jasperThemeToggle')) return;
    const button = document.createElement('button');
    button.id = 'jasperThemeToggle';
    button.type = 'button';
    button.setAttribute('aria-label', 'Toggle dark mode');
    button.title = 'Toggle dark mode';
    button.textContent = getPreferredTheme() === 'dark' ? '☀' : '☾';
    button.addEventListener('click', function () {
      const next = getPreferredTheme() === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      button.textContent = next === 'dark' ? '☀' : '☾';
    });

    const top = document.getElementById('desktopWorkspaceTop');
    if (top) top.insertBefore(button, top.firstChild);
    else document.body.appendChild(button);
  }

  function init() {
    applyTheme(getPreferredTheme());
    installToggle();
  }

  window.JasperPokedexTheme = {
    get: function () { return getPreferredTheme(); },
    set: function (theme) {
      const normalized = theme === 'dark' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, normalized);
      applyTheme(normalized);
      const button = document.getElementById('jasperThemeToggle');
      if (button) button.textContent = normalized === 'dark' ? '☀' : '☾';
    },
    toggle: function () {
      this.set(getPreferredTheme() === 'dark' ? 'light' : 'dark');
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    #jasperThemeToggle{display:none}
    @media (min-width:769px){
      #jasperThemeToggle{display:inline-flex;position:static;flex:0 0 34px;width:34px;height:34px;align-items:center;justify-content:center;padding:0;border:1px solid var(--color-border);border-radius:999px;background:var(--color-surface-elevated);color:var(--color-text-primary);box-shadow:0 2px 8px var(--color-shadow);font-size:17px;line-height:1;cursor:pointer}
      #jasperThemeToggle:hover{border-color:var(--color-border-strong);background:var(--color-dropdown)}
      #jasperThemeToggle:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}
      #desktopWorkspaceTop{gap:14px!important}
      #desktopWorkspaceTitle{height:34px!important;line-height:1.5!important;display:flex!important;align-items:center!important;box-sizing:border-box!important}
    }

    /* v0.12.1: Token Sync presentation adapts to the existing semantic theme. */
    @media (min-width:769px){
      html[data-theme="dark"] #githubSyncPill{background:var(--color-surface-elevated)!important;color:var(--color-text-primary)!important;border-color:var(--color-border-strong)!important;box-shadow:0 2px 8px var(--color-shadow)!important}
      html[data-theme="dark"] #githubSyncPill:hover{background:var(--color-dropdown)!important;border-color:var(--color-accent)!important}
      html[data-theme="dark"] #githubSyncMenu{background:var(--color-dropdown)!important;color:var(--color-text-primary)!important;border-color:var(--color-border-strong)!important;box-shadow:0 16px 36px var(--color-shadow)!important}
      html[data-theme="dark"] #githubSyncStatus{color:var(--color-text-secondary)!important}
      html[data-theme="dark"] #githubLastSynced{color:var(--color-text-tertiary)!important}
      html[data-theme="dark"] #githubTokenInput{background:var(--color-input)!important;color:var(--color-text-primary)!important;border-color:var(--color-border-strong)!important}
      html[data-theme="dark"] #githubTokenInput::placeholder{color:var(--color-text-tertiary)!important}
      html[data-theme="dark"] #githubTokenInput:focus{border-color:var(--color-focus)!important;outline:none}
      html[data-theme="dark"] #githubSyncControls button{background:var(--color-surface-elevated)!important;color:var(--color-text-primary)!important;border-color:var(--color-border-strong)!important}
      html[data-theme="dark"] #githubSyncControls button:hover{background:var(--color-selection)!important;border-color:var(--color-accent)!important}
      html[data-theme="dark"] #githubSyncNote{color:var(--color-text-tertiary)!important}
      html[data-theme="dark"] #githubSyncPill[data-state="normal"] .github-sync-icon{color:var(--color-error)!important}
      html[data-theme="dark"] #githubSyncPill[data-state="ok"] .github-sync-icon{color:var(--color-success)!important}
      html[data-theme="dark"] #githubSyncPill[data-state="busy"] .github-sync-icon{color:var(--color-accent)!important}
      html[data-theme="dark"] #githubSyncPill[data-state="warning"] .github-sync-icon{color:var(--color-warning)!important}
    }

    /* Bulk Mode: selection is blue; preserve the existing blue checkbox. */
    .cell.bulk-pending,
    .cell.completed.bulk-pending,
    .list-row.bulk-pending,
    .list-row.completed.bulk-pending{background:var(--color-pending-surface)!important;border-color:var(--color-pending-border)!important}

    /* Bulk Mode pending-count typography. */
    #bulkPendingCount{font-size:13.12px!important}
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
