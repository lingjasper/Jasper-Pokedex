(() => {
  'use strict';
  if (window.__JASPER_ICON_SYSTEM__) return;
  window.__JASPER_ICON_SYSTEM__ = true;

  const cache = new Map();
  const applyThemeColors = root => {
    const scope = root || document;
    const darkDesktop = document.documentElement.dataset.theme === 'dark' && window.matchMedia('(min-width: 769px)').matches;
    scope.querySelectorAll?.('.jasper-icon[data-icon-name="info-fill"]').forEach(svg => {
      svg.style.setProperty('--info-icon-inner-fill', darkDesktop ? '#343a46' : 'white');
    });
  };

  const load = name => {
    if (!cache.has(name)) {
      cache.set(name, fetch(`Icons/${encodeURIComponent(name)}.svg`, { cache: 'no-store' })
        .then(r => { if (!r.ok) throw Error(`Icon load failed (${r.status}): ${name}`); return r.text(); })
        .then(text => new DOMParser().parseFromString(text, 'image/svg+xml').documentElement));
    }
    return cache.get(name);
  };

  const mount = async target => {
    if (!target || target.dataset.iconMounted === 'true') return;
    const name = target.dataset.icon;
    if (!name) return;
    try {
      const source = await load(name);
      const svg = document.importNode(source, true);
      svg.dataset.iconMounted = 'true';
      svg.dataset.iconName = name;
      svg.classList.add('jasper-icon');
      svg.setAttribute('aria-hidden', target.getAttribute('aria-hidden') || 'true');
      const size = target.dataset.iconSize;
      if (size) { svg.style.width = `${size}px`; svg.style.height = `${size}px`; }
      if (target.dataset.iconClass) target.dataset.iconClass.split(/\s+/).filter(Boolean).forEach(c => svg.classList.add(c));
      if (target.isConnected) target.replaceWith(svg);
      if (name === 'info-fill') applyThemeColors(svg.parentElement || document);
    } catch (error) {
      target.dataset.iconError = 'true';
      console.warn(error);
    }
  };

  const hydrate = root => {
    const scope = root || document;
    if (scope.nodeType === 1 && scope.matches('[data-icon]:not([data-icon-mounted])')) mount(scope);
    scope.querySelectorAll('[data-icon]:not([data-icon-mounted])').forEach(mount);
    applyThemeColors(scope);
  };

  const set = async (target, name) => {
    if (!target) return;
    if (target.tagName === 'svg') {
      const holder = document.createElement('span');
      holder.dataset.icon = name;
      target.replaceWith(holder);
      return;
    }
    target.dataset.icon = name;
    delete target.dataset.iconMounted;
    await mount(target);
  };

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) hydrate(node);
      });
    }
  });

  const themeObserver = new MutationObserver(() => applyThemeColors(document));

  const boot = () => {
    hydrate(document);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    applyThemeColors(document);
  };

  window.JASPER_ICONS = { load, mount, hydrate, set };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
