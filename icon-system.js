/*
 * Shared Icon System
 *
 * Semantic icon mapping is documented in Icons/ICON_SYSTEM.md.
 * This file is the single runtime mapping from UI meaning/state to canonical SVG assets.
 * It intentionally contains no SVG path data.
 */
(function () {
  'use strict';

  const ROOT = 'Icons/';

  const ICONS = Object.freeze({
    box: Object.freeze({ selected: 'box-fill.svg', unselected: 'box-outline.svg' }),
    list: Object.freeze({ selected: 'list-fill.svg', unselected: 'list-outline.svg' }),
    completion: Object.freeze({ unchecked: 'empty-circle.svg', checked: 'check-fill.svg' }),
    search: Object.freeze({ default: 'search.svg' }),
    clear: Object.freeze({ default: 'clear-outline.svg', active: 'clear-fill.svg' }),
    theme: Object.freeze({
      light: Object.freeze({ default: 'moon-outline.svg', active: 'moon-fill.svg' }),
      dark: Object.freeze({ default: 'sun-outline.svg', active: 'sun-fill.svg' })
    }),
    sync: Object.freeze({
      inProgress: Object.freeze({ default: 'sync-inprogress-outline.svg', active: 'sync-inprogress-fill.svg' }),
      warning: Object.freeze({ default: 'sync-warn-outline.svg', active: 'sync-warn-fill.svg' }),
      tokenNeeded: 'sync-token-needed.svg',
      success: 'check-fill.svg'
    }),
    bulkMode: Object.freeze({ default: 'bulk-mode-outline.svg', active: 'bulk-mode-fill.svg' }),
    bulkPending: Object.freeze({ default: 'bulk-pending-outline.svg', active: 'bulk-pending-fill.svg' }),
    info: Object.freeze({ default: 'info-outline.svg', active: 'info-fill.svg' })
  });

  function installStyles() {
    if (document.getElementById('jasperIconSystemStyles')) return;
    const style = document.createElement('style');
    style.id = 'jasperIconSystemStyles';
    style.textContent = `
      .icon { display:inline-flex; align-items:center; justify-content:center; line-height:0; flex-shrink:0; color:inherit; }
      .icon > svg { display:block; width:100%; height:100%; }
      .checkbox { border:0!important; background:transparent!important; }
      .checkbox::after { content:none!important; display:none!important; }
      #githubSyncIcon { border:0!important; background:transparent!important; width:auto!important; height:28px!important; padding:0!important; animation:none!important; }
    `;
    document.head.appendChild(style);
  }

  function resolveIcon(name, state) {
    const entry = ICONS[name];
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (state && Object.prototype.hasOwnProperty.call(entry, state)) {
      const value = entry[state];
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object') return value.default || null;
    }
    if (entry.default && typeof entry.default === 'string') return entry.default;
    return null;
  }

  async function createIcon(name, state, options) {
    installStyles();
    const opts = options || {};
    const file = resolveIcon(name, state);
    const wrapper = document.createElement('span');
    wrapper.className = 'icon icon-' + name + (opts.className ? ' ' + opts.className : '');
    wrapper.setAttribute('aria-hidden', opts.decorative === false ? 'false' : 'true');
    if (opts.title) wrapper.title = opts.title;

    if (!file) {
      wrapper.classList.add('icon-missing');
      return wrapper;
    }

    try {
      const response = await fetch(ROOT + file, { cache: 'force-cache' });
      if (!response.ok) throw new Error('Icon request failed: ' + response.status);
      const markup = await response.text();
      const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
      const svg = parsed.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('Invalid SVG');

      svg.setAttribute('focusable', 'false');
      svg.setAttribute('aria-hidden', opts.decorative === false ? 'false' : 'true');

      const defaultSizes = {
        box: [16, 16], list: [16, 16], completion: [18, 18], clear: [16, 16], info: [18, 18]
      };
      const size = defaultSizes[name];
      const width = opts.width != null ? opts.width : size?.[0];
      const height = opts.height != null ? opts.height : size?.[1];
      if (width != null) svg.setAttribute('width', String(width));
      if (height != null) svg.setAttribute('height', String(height));
      if (width != null && height != null) {
        wrapper.style.width = width + 'px';
        wrapper.style.height = height + 'px';
      } else {
        const intrinsicWidth = parseFloat(svg.getAttribute('width'));
        const intrinsicHeight = parseFloat(svg.getAttribute('height'));
        if (Number.isFinite(intrinsicWidth)) wrapper.style.width = intrinsicWidth + 'px';
        if (Number.isFinite(intrinsicHeight)) wrapper.style.height = intrinsicHeight + 'px';
      }
      if (opts.decorative === false && opts.alt) svg.setAttribute('aria-label', opts.alt);
      wrapper.replaceChildren(document.importNode(svg, true));
    } catch (error) {
      wrapper.classList.add('icon-missing');
      wrapper.setAttribute('data-icon-error', name);
      if (window.console && console.warn) console.warn('[Icon System] Failed to load ' + file, error);
    }

    return wrapper;
  }

  async function replaceElement(element, name, state, options) {
    if (!element) return null;
    const icon = await createIcon(name, state, options);
    element.replaceChildren(icon);
    return icon;
  }

  window.JasperIcon = Object.freeze({
    icons: ICONS,
    resolve: resolveIcon,
    create: createIcon,
    replace: replaceElement
  });
})();
