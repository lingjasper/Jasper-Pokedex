/*
 * Shared Icon System
 *
 * Semantic icon mapping is documented in Icons/ICON_SYSTEM.md.
 * This file is the single runtime mapping from UI meaning/state to canonical SVG assets.
 * It intentionally does not contain SVG path data.
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

  function createIcon(name, state, options) {
    const opts = options || {};
    const file = resolveIcon(name, state);
    const img = document.createElement('img');
    img.className = 'icon icon-' + name + (opts.className ? ' ' + opts.className : '');
    img.alt = opts.alt || '';
    img.setAttribute('aria-hidden', opts.decorative === false ? 'false' : 'true');
    img.draggable = false;

    if (!file) {
      img.classList.add('icon-missing');
      img.removeAttribute('src');
      return img;
    }

    img.src = ROOT + file;
    if (opts.title) img.title = opts.title;
    if (opts.width != null) img.width = opts.width;
    if (opts.height != null) img.height = opts.height;
    return img;
  }

  function replaceElement(element, name, state, options) {
    if (!element) return null;
    const icon = createIcon(name, state, options);
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
