/*
 * pokedex.js — Pokédex details for one entry, read from PokéAPI.
 *
 * Returns a small, display-ready object. Raw PokéAPI responses are large
 * (a single /pokemon record is several hundred KB), so they are never written
 * to localStorage; only the derived summary is kept, with a size cap.
 */
import { assetSlug, damageTaken, pickPast, safeStorage } from './core.js';

const API = 'https://pokeapi.co/api/v2';
const CACHE_KEY = 'jasper_pokedex_detail_v1';
const CACHE_LIMIT = 40;
// Earlier releases stored every raw response under these keys.
const RETIRED_CACHE_KEYS = ['jasper_pokeapi_cache_v1', 'jasper_pokeapi_cache_v3'];

const FAMILIES = [
  { generation: 5, versions: ['black', 'white', 'black-2', 'white-2'], games: ['pokemon-black', 'pokemon-white', 'pokemon-black-2', 'pokemon-white-2'] },
  { generation: 6, versions: ['x', 'y', 'omega-ruby', 'alpha-sapphire'], games: ['pokemon-x', 'pokemon-y', 'pokemon-omega-ruby', 'pokemon-alpha-sapphire'] },
  { generation: 7, versions: ['sun', 'moon', 'ultra-sun', 'ultra-moon'], games: ['pokemon-sun', 'pokemon-moon', 'pokemon-ultra-sun', 'pokemon-ultra-moon'] }
];
const VERSION_LABELS = {
  black: 'Black', white: 'White', 'black-2': 'Black 2', 'white-2': 'White 2',
  x: 'X', y: 'Y', 'omega-ruby': 'Omega Ruby', 'alpha-sapphire': 'Alpha Sapphire',
  sun: 'Sun', moon: 'Moon', 'ultra-sun': 'Ultra Sun', 'ultra-moon': 'Ultra Moon'
};
const STARTERS = {
  5: ['snivy', 'tepig', 'oshawott'],
  6: { 'x': ['chespin', 'fennekin', 'froakie'], 'y': ['chespin', 'fennekin', 'froakie'], 'omega-ruby': ['treecko', 'torchic', 'mudkip'], 'alpha-sapphire': ['treecko', 'torchic', 'mudkip'] },
  7: ['rowlet', 'litten', 'popplio']
};
const EGG_CYCLE_STEPS = { 5: 257, 6: 257, 7: 256 };
const METHODS = {
  walk: 'Tall grass', walking: 'Walking', surf: 'Surfing', 'old-rod': 'Old Rod', 'good-rod': 'Good Rod',
  'super-rod': 'Super Rod', 'rock-smash': 'Rock Smash', headbutt: 'Headbutt', 'dark-grass': 'Dark grass'
};
const VARIETY_FORMS = { alolan: 'alola', red: 'red-striped', blue: 'blue-striped' };
const REGIONAL_FORMS = { alolan: 'alola', galarian: 'galar', hisuian: 'hisui', paldean: 'paldea' };
// Generation in which each PokéAPI version group was released.
const VERSION_GROUP_GENERATION = {
  'red-blue': 1, yellow: 1, 'gold-silver': 2, crystal: 2,
  'ruby-sapphire': 3, emerald: 3, 'firered-leafgreen': 3, colosseum: 3, xd: 3,
  'diamond-pearl': 4, platinum: 4, 'heartgold-soulsilver': 4,
  'black-white': 5, 'black-2-white-2': 5,
  'x-y': 6, 'omega-ruby-alpha-sapphire': 6,
  'sun-moon': 7, 'ultra-sun-ultra-moon': 7, 'lets-go-pikachu-lets-go-eevee': 7,
  'sword-shield': 8, 'the-isle-of-armor': 8, 'the-crown-tundra': 8, 'brilliant-diamond-and-shining-pearl': 8, 'legends-arceus': 8,
  'scarlet-violet': 9, 'the-teal-mask': 9, 'the-indigo-disk': 9, 'legends-za': 9
};

export const familyFor = game => FAMILIES.find(family => family.games.includes(game)) || null;

const title = value => String(value || '').split('-').map(part => (part ? part[0].toUpperCase() + part.slice(1) : part)).join(' ');
const placeName = value => title(String(value || 'unknown')
  .replace(/-area$/, '')
  .replace(/^(kanto|johto|hoenn|sinnoh|unova|kalos|alola)-(?=route|sea-route|victory-road)/, ''));

/* ---------- requests ---------- */

const inflight = new Map();
const getJson = (path, { keep = false } = {}) => {
  const url = path.startsWith('http') ? path : `${API}/${path}`;
  if (inflight.has(url)) return inflight.get(url);
  const request = fetch(url, { headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) {
        const error = new Error(response.status === 404 ? 'PokéAPI has no record for this Pokémon.' : `PokéAPI request failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    })
    .finally(() => { if (!keep) inflight.delete(url); });
  if (keep) request.catch(() => inflight.delete(url));
  inflight.set(url, request);
  return request;
};
// Type records are small and shared by every Pokémon, so they stay in memory.
const getType = name => getJson(`type/${name}`, { keep: true });

/* ---------- derived pieces ---------- */

function requirement(detail) {
  if (!detail) return '';
  const parts = [];
  if (detail.min_level != null) parts.push(`level ${detail.min_level}`);
  if (detail.item?.name) parts.push(`use ${title(detail.item.name)}`);
  if (detail.trigger?.name === 'trade') parts.push(detail.trade_species?.name ? `trade for ${title(detail.trade_species.name)}` : 'trade');
  if (detail.min_happiness != null) parts.push('high friendship');
  if (detail.min_beauty != null) parts.push(`beauty ${detail.min_beauty}`);
  if (detail.min_affection != null) parts.push(`affection ${detail.min_affection}`);
  if (detail.held_item?.name) parts.push(`holding ${title(detail.held_item.name)}`);
  if (detail.known_move?.name) parts.push(`knowing ${title(detail.known_move.name)}`);
  if (detail.known_move_type?.name) parts.push(`knowing a ${title(detail.known_move_type.name)}-type move`);
  if (detail.location?.name) parts.push(`at ${placeName(detail.location.name)}`);
  if (detail.time_of_day) parts.push(`during the ${detail.time_of_day}`);
  if (detail.gender === 1) parts.push('female only');
  if (detail.gender === 2) parts.push('male only');
  if (detail.needs_overworld_rain) parts.push('while it rains');
  if (detail.party_species?.name) parts.push(`with ${title(detail.party_species.name)} in the party`);
  if (detail.party_type?.name) parts.push(`with a ${title(detail.party_type.name)}-type in the party`);
  if (detail.relative_physical_stats === 1) parts.push('Attack above Defense');
  if (detail.relative_physical_stats === 0) parts.push('Attack equal to Defense');
  if (detail.relative_physical_stats === -1) parts.push('Attack below Defense');
  if (detail.turn_upside_down) parts.push('console held upside down');
  if (!parts.length && detail.trigger?.name) parts.push(title(detail.trigger.name));
  return parts.join(', ');
}

/**
 * One evolution can list several methods: per regional form (Galarian
 * Darumaka uses an Ice Stone) and per era (Leafeon: a mossy rock, later a
 * Leaf Stone). Keep the ones that apply to this entry's form and this game's
 * generation. If the filters would remove everything, keep the full list.
 */
export function pickEvolutionDetails(details, { form = '', generation = 0 } = {}) {
  let list = details || [];
  if (list.length < 2) return list;
  const regionOf = detail => detail.region?.name
    || `${detail.required_pokemon_form?.name || ''} ${detail.evolved_pokemon_form?.name || ''}`.match(/-(alola|galar|hisui|paldea)\b/)?.[1]
    || '';
  const wanted = REGIONAL_FORMS[form] || '';
  const regional = list.filter(detail => regionOf(detail) === wanted);
  if (regional.length) list = regional;
  if (generation) {
    const era = detail => VERSION_GROUP_GENERATION[detail.version_group?.name] || 0;
    const known = list.filter(detail => era(detail) <= generation);
    if (known.length) list = known;
    // Location methods differ per region: prefer the place from this generation.
    if (list.some(detail => detail.location && era(detail) === generation)) {
      list = list.filter(detail => !detail.location || era(detail) === generation);
    }
  }
  return list;
}

function evolutionSteps(chain, displayName, context) {
  const steps = [];
  const walk = node => {
    for (const next of node.evolves_to || []) {
      const hows = [...new Set(pickEvolutionDetails(next.evolution_details, context).map(requirement).filter(Boolean))];
      steps.push({
        from: node.species.name,
        to: next.species.name,
        fromName: displayName(node.species.name),
        toName: displayName(next.species.name),
        how: hows.slice(0, 3)
      });
      walk(next);
    }
  };
  walk(chain);
  return steps;
}

function encounterGroups(encounters, versions, starterVersions) {
  const groups = new Map();
  const add = row => {
    const key = [row.version, row.place, row.method, row.conditions].join('|');
    if (!groups.has(key)) groups.set(key, { ...row, total: 0, levels: [] });
    const group = groups.get(key);
    // Each encounter slot carries its own share; the method's rate is their sum.
    if (row.chance != null) group.total += row.chance;
    if (row.min != null) group.levels.push(row.min);
    if (row.max != null) group.levels.push(row.max);
  };
  for (const area of encounters || []) {
    const place = placeName(area.location_area?.name);
    for (const detail of area.version_details || []) {
      const version = detail.version?.name;
      if (!versions.includes(version)) continue;
      for (const encounter of detail.encounter_details || []) {
        add({
          version,
          place,
          method: METHODS[encounter.method?.name] || title(encounter.method?.name || 'unknown'),
          conditions: (encounter.condition_values || []).map(value => title(value?.name)).filter(Boolean).sort().join(', '),
          chance: encounter.chance ?? null,
          min: encounter.min_level ?? null,
          max: encounter.max_level ?? null
        });
      }
    }
  }
  for (const version of starterVersions) {
    add({ version, place: 'Start of the game', method: 'Starter Pokémon', conditions: '', chance: null, min: null, max: null });
  }
  const span = (values, unit) => {
    if (!values.length) return '';
    const low = Math.min(...values);
    const high = Math.max(...values);
    return low === high ? unit(low) : unit(`${low}–${high}`);
  };
  return versions
    .map(version => {
      const places = new Map();
      for (const group of groups.values()) {
        if (group.version !== version) continue;
        if (!places.has(group.place)) places.set(group.place, []);
        places.get(group.place).push({
          method: group.method,
          conditions: group.conditions,
          chance: group.total ? `${Math.min(100, group.total)}%` : '',
          levels: span(group.levels, value => `Lv. ${value}`)
        });
      }
      return { version, game: VERSION_LABELS[version] || title(version), places: [...places.entries()].map(([place, rows]) => ({ place, rows })) };
    })
    .filter(group => group.places.length);
}

/* ---------- public API ---------- */

export function createPokedex({ storage = safeStorage(globalThis.localStorage) } = {}) {
  let cache = null;
  const readCache = () => {
    if (!cache) {
      const stored = storage.json(CACHE_KEY, []);
      cache = new Map(Array.isArray(stored) ? stored : []);
    }
    return cache;
  };
  const remember = (key, value) => {
    const map = readCache();
    map.delete(key);
    map.set(key, value);
    while (map.size > CACHE_LIMIT) map.delete(map.keys().next().value);
    storage.set(CACHE_KEY, JSON.stringify([...map.entries()]));
  };

  return {
    /** Free the space earlier releases used for raw API responses. */
    retireOldCaches() { RETIRED_CACHE_KEYS.forEach(key => storage.remove(key)); },

    cached(game, entry) { return readCache().get(`${game}:${entry.id}`) || null; },

    /**
     * entry: a dataset entry. dexNames: Map<species slug, display name> for the
     * active game, used to label evolution steps without extra requests.
     */
    async load(game, entry, dexNames = new Map()) {
      const key = `${game}:${entry.id}`;
      const hit = readCache().get(key);
      if (hit) return hit;

      const family = familyFor(game);
      const generation = family?.generation || 0;
      const versions = family?.versions || [];
      const speciesName = assetSlug(entry.baseName);
      const species = await getJson(`pokemon-species/${speciesName}`);

      // A species can have several "varieties" (forms with their own stats and
      // types). Pick the one that matches this entry's form, else the default.
      const formSlug = assetSlug(entry.form);
      const wanted = formSlug ? `${speciesName}-${VARIETY_FORMS[formSlug] || formSlug}` : '';
      const varieties = species.varieties || [];
      const variety = varieties.find(item => item.pokemon?.name === wanted)
        || varieties.find(item => item.is_default)
        || varieties[0];
      if (!variety?.pokemon?.url) throw new Error('PokéAPI has no record for this Pokémon.');
      const pokemon = await getJson(variety.pokemon.url);

      const pastTypes = pickPast(pokemon.past_types, generation, 'types');
      const types = [...(pastTypes?.length ? pastTypes : pokemon.types || [])]
        .sort((a, b) => a.slot - b.slot)
        .map(item => item.type.name);

      const starterVersions = versions.filter(version => {
        const list = Array.isArray(STARTERS[generation]) ? STARTERS[generation] : STARTERS[generation]?.[version];
        return (list || []).includes(species.name);
      });

      const [chain, encounters, typeData] = await Promise.all([
        species.evolution_chain?.url ? getJson(species.evolution_chain.url) : null,
        versions.length && pokemon.location_area_encounters ? getJson(pokemon.location_area_encounters).catch(() => []) : [],
        Promise.all(types.map(getType))
      ]);

      const displayName = name => dexNames.get(name) || title(name);
      const heldItems = [];
      for (const held of pokemon.held_items || []) {
        const details = (held.version_details || []).filter(item => versions.includes(item.version?.name));
        if (!details.length) continue;
        heldItems.push({ item: title(held.item?.name), rarity: Math.max(...details.map(item => item.rarity || 0)) || null });
      }

      const detail = {
        national: species.id,
        species: species.name,
        generation,
        types,
        evolution: chain ? evolutionSteps(chain.chain, displayName, { form: formSlug, generation }) : [],
        locations: encounterGroups(encounters, versions, starterVersions),
        hasLocationData: versions.length > 0,
        damage: damageTaken(typeData, generation),
        eggCycles: species.hatch_counter ?? null,
        eggSteps: species.hatch_counter != null && EGG_CYCLE_STEPS[generation] ? EGG_CYCLE_STEPS[generation] * (species.hatch_counter + 1) : null,
        captureRate: species.capture_rate ?? null,
        heldItems
      };
      remember(key, detail);
      return detail;
    }
  };
}
