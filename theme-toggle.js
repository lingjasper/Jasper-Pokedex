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
    document.body.appendChild(button);
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
      #jasperThemeToggle{display:inline-flex;position:fixed;right:32px;bottom:28px;z-index:12000;width:40px;height:40px;align-items:center;justify-content:center;padding:0;border:1px solid var(--color-border);border-radius:999px;background:var(--color-surface-elevated);color:var(--color-text-primary);box-shadow:0 2px 8px var(--color-shadow);font-size:18px;line-height:1;cursor:pointer}
      #jasperThemeToggle:hover{border-color:var(--color-border-strong);background:var(--color-dropdown)}
      #jasperThemeToggle:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
