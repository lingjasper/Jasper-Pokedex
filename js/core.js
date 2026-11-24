/*
 * core.js — pure data logic for Jasper's Pokédex.
 *
 * Nothing in this file touches the DOM, the network, or storage, so it can be
 * imported from Node for tests (see tests/core.test.mjs).
 */

export const BOX_COLUMNS = 6;
export const BOX_ROWS = 5;
export const BOX_SIZE = BOX_COLUMNS * BOX_ROWS;

/* ---------- text helpers ---------- */

// toLowerCase (not toLocaleLowerCase): entry ids must not change with the
// device language. A Turkish locale lowercases "I" to a dotless "ı".
export const norm = value =>
  String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const slug = value =>
  norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

/* ---------- storage ---------- */

/**
 * localStorage / sessionStorage can be missing, full, or blocked (private
 * browsing, embedded frames). Every access goes through this wrapper so a
 * storage failure degrades to "not remembered" instead of breaking the page.
 */
export function safeStorage(area) {
  return {
    get(key) { try { return area.getItem(key); } catch { return null; } },
    set(key, value) { try { area.setItem(key, value); return true; } catch { return false; } },
    remove(key) { try { area.removeItem(key); } catch { /* ignore */ } },
    json(key, fallback = null) {
      try {
        const value = JSON.parse(area.getItem(key) ?? 'null');
        return value ?? fallback;
      } catch { return fallback; }
    }
  };
}

/* ---------- dataset ---------- */

const DEX_ROW = /^\|\s*#?(\d+)\s*\|\s*(.*?)\s*\|\s*$/;
const NAME_WITH_FORM = /^(.*?)\s*\(([^)]*)\)$/;

/**
 * Parse a Pokedexes/*.md table into entries.
 * A row is `| #016 | Unfezant (Male) |`. The id is `016-unfezant-male`,
 * which is the key used in localStorage and in saves/<game>.json.
 */
export function parseDex(text) {
  const entries = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const row = line.match(DEX_ROW);
    if (!row) continue;
    const num = row[1].padStart(3, '0');
    const name = row[2].trim();
    if (!name || /^-+$/.test(name)) continue;
    const withForm = name.match(NAME_WITH_FORM);
    const baseName = withForm ? withForm[1].trim() : name;
    const form = withForm ? withForm[2].trim() : '';
    const speciesId = slug(baseName);
    const id = `${num}-${speciesId}${form ? `-${slug(form)}` : ''}`;
    entries.push({ id, num, name, baseName, form, speciesId });
  }
  return entries;
}

/** Split entries into storage boxes of BOX_SIZE. Always returns at least one box. */
export function toBoxes(entries, size = BOX_SIZE) {
  const count = Math.max(1, Math.ceil(entries.length / size));
  const boxes = [];
  for (let index = 0; index < count; index++) {
    const items = entries.slice(index * size, (index + 1) * size);
    boxes.push({
      index,
      items,
      first: items.length ? items[0].num : null,
      last: items.length ? items[items.length - 1].num : null
    });
  }
  return boxes;
}

/* ---------- collection state ---------- */

/**
 * Map a saved state onto the current entry ids.
 * Accepts the current ids plus every key shape older releases wrote:
 *   "102"            position within a dex number
 *   "016-1"          second entry that shares a dex number
 *   "016-M"/"016-F"  compact gender keys
 *   "159-Spring"     dex number + form
 * Unknown keys are dropped. Values are coerced to booleans.
 */
export function migrateState(entries, state) {
  if (!state || typeof state !== 'object') return {};
  if (!Array.isArray(entries) || !entries.length) return { ...state };

  const valid = new Map(entries.map(entry => [entry.id.toLowerCase(), entry.id]));
  const semantic = new Map();
  const positional = new Map();
  const seen = new Map();
  for (const entry of entries) {
    const n = seen.get(entry.num) || 0;
    seen.set(entry.num, n + 1);
    positional.set(n ? `${entry.num}-${n}` : entry.num, entry.id);
    if (entry.form) {
      const form = slug(entry.form);
      semantic.set(`${entry.num}-${form}`, entry.id);
      if (form === 'male') semantic.set(`${entry.num}-m`, entry.id);
      if (form === 'female') semantic.set(`${entry.num}-f`, entry.id);
    }
  }

  const out = {};
  for (const [key, value] of Object.entries(state)) {
    const k = String(key).toLowerCase();
    const id = valid.get(k) || semantic.get(k) || positional.get(k);
    if (id) out[id] = value === true;
  }
  return out;
}

/** True when two states mark the same entries as registered. */
export function sameState(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) if ((a?.[key] === true) !== (b?.[key] === true)) return false;
  return true;
}

/** Ids whose registered flag differs between two states. */
export function changedIds(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter(key => (before?.[key] === true) !== (after?.[key] === true));
}

export function progress(entries, state) {
  const total = entries.length;
  let done = 0;
  for (const entry of entries) if (state?.[entry.id] === true) done++;
  return { done, total, remaining: total - done, percent: Math.round((done / Math.max(1, total)) * 100) };
}

/* ---------- search ---------- */

/**
 * Match on name (accent-insensitive, anywhere) or dex number.
 * Ranked: exact number, name starts with the query, number contains, name contains.
 */
export function searchEntries(entries, query, limit = 50) {
  const q = norm(query).trim();
  if (!q) return [];
  const digits = q.replace(/^#/, '');
  const numeric = /^\d+$/.test(digits);
  const ranked = [];
  entries.forEach((entry, order) => {
    const name = norm(entry.name);
    let rank = -1;
    if (numeric && entry.num === digits.padStart(3, '0')) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (numeric && entry.num.includes(digits)) rank = 2;
    else if (name.includes(q)) rank = 3;
    if (rank >= 0) ranked.push({ entry, rank, order });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.slice(0, limit).map(item => item.entry);
}

/* ---------- sprites ---------- */

// Forms whose artwork is the species' base sprite (no "-form" file exists).
const BASE_SPRITE_FORMS = new Set(['male', 'spring', 'baile', 'midday', 'west', 'normal']);

const SPRITE_ALIASES = {
  'basculin|red': 'basculin',
  'basculin|red-striped': 'basculin',
  'basculin|blue': 'basculin-blue-striped',
  'basculin|blue-striped': 'basculin-blue-striped'
};

/**
 * Slug used for artwork files and PokéAPI names: apostrophes vanish
 * ("Farfetch'd" -> farfetchd, "Pa'u" -> pau) and gender symbols become -f / -m.
 * Entry ids keep using slug() so saved progress never changes key.
 */
export const assetSlug = value =>
  slug(String(value ?? '').replace(/['’]/g, '').replace(/♀/g, ' f').replace(/♂/g, ' m'));

/**
 * File names (without extension) to try under Sprites/, best guess first.
 * The UI walks the list on image error, so a new sprite only has to be
 * dropped into the folder under one of these names.
 */
export function spriteCandidates(baseName, form = '') {
  const name = assetSlug(baseName);
  const variant = assetSlug(form);
  const out = [];
  const alias = SPRITE_ALIASES[`${name}|${variant}`];
  if (alias) out.push(alias);
  else if (variant === 'alolan') out.push(`${name}-alola`);
  if (variant && !BASE_SPRITE_FORMS.has(variant)) out.push(`${name}-${variant}`);
  out.push(name);
  return [...new Set(out)];
}

/* ---------- placeholder art ---------- */

const hash32 = text => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * A small symmetric pixel pattern, unique per seed, drawn on the same 68×56
 * canvas and baseline as the real sprites. Shown when a sprite file is
 * missing, and in demo mode where no artwork is loaded at all.
 */
export function placeholderArt(seed) {
  const h = hash32(String(seed));
  const hue = h % 360;
  const light = `hsl(${hue} 46% 64%)`;
  const dark = `hsl(${hue} 40% 46%)`;
  const px = 5;
  const left = 22;
  const top = 27;
  let rects = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const bit = row * 3 + col;
      const on = (h >>> (bit + 9)) & 1 || (row > 0 && row < 4 && col === 2);
      if (!on) continue;
      const fill = (h >>> (bit % 9)) & 1 ? light : dark;
      const y = top + row * px;
      rects += `<rect x="${left + col * px}" y="${y}" width="${px}" height="${px}" fill="${fill}"/>`;
      if (col < 2) rects += `<rect x="${left + (4 - col) * px}" y="${y}" width="${px}" height="${px}" fill="${fill}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 56" shape-rendering="crispEdges">${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ---------- type matchups ---------- */

const GENERATION_ORDER = [
  'generation-i', 'generation-ii', 'generation-iii', 'generation-iv', 'generation-v',
  'generation-vi', 'generation-vii', 'generation-viii', 'generation-ix'
];
const generationNumber = name => GENERATION_ORDER.indexOf(name) + 1;

const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

/** Attacking types that exist in a generation (Fairy arrived in generation 6). */
export const typesForGeneration = generation =>
  generation && generation < 6 ? TYPES.filter(type => type !== 'fairy') : [...TYPES];

/**
 * PokéAPI lists older rules under `past_*` with the LAST generation they
 * applied to. For a game in generation N, use the earliest past entry whose
 * generation is >= N, otherwise the current rules.
 */
export function pickPast(pastList, generation, field) {
  if (!generation) return null;
  const candidates = (pastList || [])
    .map(item => ({ item, gen: generationNumber(item.generation?.name) }))
    .filter(x => x.gen >= generation)
    .sort((a, b) => a.gen - b.gen);
  return candidates.length ? candidates[0].item[field] : null;
}

/**
 * Damage multipliers a Pokémon takes from every attacking type.
 * `defenderTypes` are PokéAPI /type resources for each of the Pokémon's types.
 * Returns groups ordered from most to least damage, without the neutral 1× group.
 */
export function damageTaken(defenderTypes, generation) {
  const names = list => (list || []).map(type => type.name);
  const multiplier = new Map(typesForGeneration(generation).map(type => [type, 1]));
  for (const data of defenderTypes) {
    const relations = pickPast(data.past_damage_relations, generation, 'damage_relations') || data.damage_relations || {};
    const none = new Set(names(relations.no_damage_from));
    const half = new Set(names(relations.half_damage_from));
    const double = new Set(names(relations.double_damage_from));
    for (const [attacker, value] of multiplier) {
      const factor = none.has(attacker) ? 0 : half.has(attacker) ? 0.5 : double.has(attacker) ? 2 : 1;
      multiplier.set(attacker, value * factor);
    }
  }
  const groups = new Map();
  for (const [attacker, value] of multiplier) {
    if (value === 1) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(attacker);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([value, types]) => ({ multiplier: value, types }));
}
