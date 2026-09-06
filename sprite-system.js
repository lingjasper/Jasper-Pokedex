(() => {
  'use strict';

  // Canonical sprite resolver. Dex data supplies a display name/form; this layer
  // normalizes known form labels to the actual asset naming used in Sprites/.
  const aliases = new Map([
    ['basculin (red)', 'basculin'],
    ['basculin (blue)', 'basculin-blue-striped'],
    ['basculin (red-striped)', 'basculin'],
    ['basculin (blue-striped)', 'basculin-blue-striped'],
    ['diglett (alolan)', 'diglett-alola'],
    ['dugtrio (alolan)', 'dugtrio-alola'],
    ['geodude (alolan)', 'geodude-alola'],
    ['graveler (alolan)', 'graveler-alola'],
    ['golem (alolan)', 'golem-alola'],
    ['meowth (alolan)', 'meowth-alola'],
    ['persian (alolan)', 'persian-alola'],
    ['rattata (alolan)', 'rattata-alola'],
    ['raticate (alolan)', 'raticate-alola'],
    ['raichu (alolan)', 'raichu-alola'],
    ['sandshrew (alolan)', 'sandshrew-alola'],
    ['sandslash (alolan)', 'sandslash-alola'],
    ['vulpix (alolan)', 'vulpix-alola'],
    ['ninetales (alolan)', 'ninetales-alola'],
    ['marowak (alolan)', 'marowak-alola'],
    ['exeggutor (alolan)', 'exeggutor-alola'],
    ['grimer (alolan)', 'grimer-alola'],
    ['muk (alolan)', 'muk-alola']
  ]);

  const normalize = value => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ');

  const slug = value => normalize(value)
    .replace(/\(([^)]+)\)/g, '-$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');

  const candidates = (name, form) => {
    const full = normalize(form ? `${name} (${form})` : name);
    const base = slug(name);
    const fullSlug = slug(full);
    const explicit = aliases.get(full);
    const list = [];
    if (explicit) list.push(explicit);
    if (fullSlug) list.push(fullSlug);
    if (base) list.push(base);
    return [...new Set(list)];
  };

  const cache = new Map();

  const resolve = (name, form = '') => {
    const key = `${normalize(name)}|${normalize(form)}`;
    if (!cache.has(key)) {
      const list = candidates(name, form);
      const promise = (async () => {
        for (const candidate of list) {
          const response = await fetch(`Sprites/${encodeURIComponent(candidate)}.png`, { cache: 'no-store' });
          if (response.ok) return `Sprites/${candidate}.png`;
        }
        return null;
      })();
      cache.set(key, promise);
    }
    return cache.get(key);
  };

  const apply = async (img, name, form = '') => {
    const src = await resolve(name, form);
    if (!src) {
      img.removeAttribute('src');
      img.dataset.spriteMissing = 'true';
      return false;
    }
    img.src = src;
    img.dataset.spriteMissing = 'false';
    return true;
  };

  window.JASPER_SPRITES = Object.freeze({ resolve, apply });
})();
