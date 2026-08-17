(function () {
  const STORAGE_KEY = 'jasper-pokedex-theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    root.dataset.theme = isDesktop && theme === 'dark' ? 'dark' : 'light';
    root.dataset.themePreference = theme;
  }

  function init() {
    applyTheme(getPreferredTheme());
  }

  window.JasperPokedexTheme = {
    get: function () { return localStorage.getItem(STORAGE_KEY) || 'light'; },
    set: function (theme) {
      const normalized = theme === 'dark' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, normalized);
      applyTheme(normalized);
    },
    toggle: function () {
      this.set(this.get() === 'dark' ? 'light' : 'dark');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
