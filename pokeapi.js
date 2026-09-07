(() => {
  'use strict';

  /*
   * PokéAPI adapter for the existing Pokédex detail panel.
   * Core collection/save data remains owned by pokedex-engine.js.
   */
  const API_ROOT = 'https://pokeapi.co/api/v2';
  const CACHE_KEY = 'jasper_pokeapi_cache_v1';
  const cache = new Map();
  const pending = new Map();

  const GAME_FAMILIES = {
    'pokemon-white-2': ['black', 'white', 'black-2', 'white-2'],
    'pokemon-black-2': ['black', 'white', 'black-2', 'white-2'],
    'pokemon-white': ['black', 'white', 'black-2', 'white-2'],
    'pokemon-black': ['black', 'white', 'black-2', 'white-2'],
    'pokemon-alpha-sapphire': ['x', 'y', 'omega-ruby', 'alpha-sapphire'],
    'pokemon-omega-ruby': ['x', 'y', 'omega-ruby', 'alpha-sapphire'],
    'pokemon-x': ['x', 'y', 'omega-ruby', 'alpha-sapphire'],
    'pokemon-y': ['x', 'y', 'omega-ruby', 'alpha-sapphire'],
    'pokemon-sun': ['sun', 'moon', 'ultra-sun', 'ultra-moon'],
    'pokemon-moon': ['sun', 'moon', 'ultra-sun', 'ultra-moon'],
    'pokemon-ultra-sun': ['sun', 'moon', 'ultra-sun', 'ultra-moon'],
    'pokemon-ultra-moon': ['sun', 'moon', 'ultra-sun', 'ultra-moon']
  };

  const VERSION_LABELS = {
    black: 'Black', white: 'White', 'black-2': 'Black 2', 'white-2': 'White 2',
    x: 'X', y: 'Y', 'omega-ruby': 'Omega Ruby', 'alpha-sapphire': 'Alpha Sapphire',
    sun: 'Sun', moon: 'Moon', 'ultra-sun': 'Ultra Sun', 'ultra-moon': 'Ultra Moon'
  };

  const STARTERS = {
    black: ['snivy', 'tepig', 'oshawott'], white: ['snivy', 'tepig', 'oshawott'],
    'black-2': ['snivy', 'tepig', 'oshawott'], 'white-2': ['snivy', 'tepig', 'oshawott'],
    x: ['chespin', 'fennekin', 'froakie'], y: ['chespin', 'fennekin', 'froakie'],
    'omega-ruby': ['treecko', 'torchic', 'mudkip'], 'alpha-sapphire': ['treecko', 'torchic', 'mudkip'],
    sun: ['rowlet', 'litten', 'popplio'], moon: ['rowlet', 'litten', 'popplio'],
    'ultra-sun': ['rowlet', 'litten', 'popplio'], 'ultra-moon': ['rowlet', 'litten', 'popplio']
  };

  const GENERATIONS = {
    1: ['generation-i'], 2: ['generation-ii'], 3: ['generation-iii'], 4: ['generation-iv'],
    5: ['generation-v'], 6: ['generation-vi'], 7: ['generation-vii'], 8: ['generation-viii'], 9: ['generation-ix']
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const title = value => String(value || '').split('-').map(x => x ? x[0].toUpperCase() + x.slice(1) : x).join(' ');
  const sleepSafe = value => value == null ? '' : String(value);

  const readCache = () => {
    if (cache.size) return;
    try {
      const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      Object.entries(stored).forEach(([key, value]) => cache.set(key, value));
    } catch (_) {}
  };

  const persistCache = () => {
    try {
      const out = {};
      for (const [key, value] of cache) out[key] = value;
      localStorage.setItem(CACHE_KEY, JSON.stringify(out));
    } catch (_) {}
  };

  const get = async path => {
    readCache();
    const url = path.startsWith('http') ? path : `${API_ROOT}/${path.replace(/^\//, '')}`;
    if (cache.has(url)) return cache.get(url);
    if (pending.has(url)) return pending.get(url);
    const request = fetch(url, { headers: { Accept: 'application/json' } }).then(async response => {
      if (!response.ok) throw new Error(`PokéAPI request failed (${response.status})`);
      const data = await response.json();
      cache.set(url, data);
      persistCache();
      pending.delete(url);
      return data;
    }).catch(error => {
      pending.delete(url);
      throw error;
    });
    pending.set(url, request);
    return request;
  };

  const versionNamesForGame = game => GAME_FAMILIES[game] || [];
  const generationForGame = game => {
    if (/pokemon-(white|black)(-2)?$/.test(game)) return 5;
    if (/pokemon-(alpha-sapphire|omega-ruby|x|y)$/.test(game)) return 6;
    if (/pokemon-(sun|moon|ultra-sun|ultra-moon)$/.test(game)) return 7;
    return 0;
  };

  const normalizePokemonName = (name, form = '') => {
    const n = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const f = String(form || '').toLowerCase().replace(/^\(|\)$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const aliases = {
      'diglett-alolan': 'diglett-alola', 'dugtrio-alolan': 'dugtrio-alola', 'geodude-alolan': 'geodude-alola',
      'graveler-alolan': 'graveler-alola', 'golem-alolan': 'golem-alola', 'meowth-alolan': 'meowth-alola',
      'persian-alolan': 'persian-alola', 'rattata-alolan': 'rattata-alola', 'raticate-alolan': 'raticate-alola',
      'raichu-alolan': 'raichu-alola', 'sandshrew-alolan': 'sandshrew-alola', 'sandslash-alolan': 'sandslash-alola',
      'vulpix-alolan': 'vulpix-alola', 'ninetales-alolan': 'ninetales-alola', 'marowak-alolan': 'marowak-alola',
      'exeggutor-alolan': 'exeggutor-alola', 'grimer-alolan': 'grimer-alola', 'muk-alolan': 'muk-alola'
    };
    const candidate = f && f !== 'normal' ? `${n}-${f}` : n;
    return aliases[candidate] || candidate;
  };

  const fetchPokemon = async (name, form) => {
    const candidate = normalizePokemonName(name, form);
    try { return await get(`pokemon/${candidate}`); } catch (_) { return get(`pokemon/${String(name).toLowerCase()}`); }
  };

  const fetchSpecies = species => get(species?.url || `pokemon-species/${species?.name || species}`);
  const fetchEvolution = url => get(url);

  const speciesDisplayName = async name => {
    try {
      const data = await get(`pokemon-species/${name}`);
      return data.names?.find(x => x.language?.name === 'en')?.name || title(name);
    } catch (_) { return title(name); }
  };

  const requirementParts = detail => {
    if (!detail) return [];
    const parts = [];
    if (detail.min_level != null) parts.push(`Lvl ${detail.min_level}`);
    if (detail.item?.name) parts.push(`use ${title(detail.item.name)}`);
    if (detail.trigger?.name === 'trade') parts.push(detail.trade_species?.name ? `trade for ${title(detail.trade_species.name)}` : 'trade');
    if (detail.min_happiness != null) parts.push(`friendship ${detail.min_happiness}`);
    if (detail.min_beauty != null) parts.push(`beauty ${detail.min_beauty}`);
    if (detail.min_affection != null) parts.push(`affection ${detail.min_affection}`);
    if (detail.held_item?.name) parts.push(`holding ${title(detail.held_item.name)}`);
    if (detail.known_move?.name) parts.push(`knowing ${title(detail.known_move.name)}`);
    if (detail.known_move_type?.name) parts.push(`knowing a ${title(detail.known_move_type.name)}-type move`);
    if (detail.location?.name) parts.push(`at ${title(detail.location.name)}`);
    if (detail.time_of_day) parts.push(`during ${detail.time_of_day}`);
    if (detail.gender === 1) parts.push('as female');
    if (detail.gender === 2) parts.push('as male');
    if (detail.near_special_rock) parts.push('near a special rock');
    if (detail.needs_overworld_rain) parts.push('during rain');
    if (detail.needs_multiplayer) parts.push('with multiplayer');
    if (detail.party_species?.name) parts.push(`with ${title(detail.party_species.name)} in party`);
    if (detail.party_type?.name) parts.push(`with a ${title(detail.party_type.name)}-type Pokémon in party`);
    if (detail.relative_physical_stats === 1) parts.push('with Attack greater than Defense');
    if (detail.relative_physical_stats === 0) parts.push('with Attack equal to Defense');
    if (detail.relative_physical_stats === -1) parts.push('with Attack lower than Defense');
    if (detail.used_move?.name) parts.push(`using ${title(detail.used_move.name)}`);
    if (detail.min_move_count != null) parts.push(`${detail.min_move_count} move uses`);
    if (detail.min_steps != null) parts.push(`${detail.min_steps} steps`);
    if (detail.min_damage_taken != null) parts.push(`${detail.min_damage_taken} damage taken`);
    if (detail.turn_upside_down) parts.push('turn the console upside down');
    return parts;
  };

  const collectEvolution = async (link, generation) => {
    const from = await speciesDisplayName(link.species.name);
    const edges = [];
    for (const next of link.evolves_to || []) {
      const details = (next.evolution_details || []).filter(d => !d.version_group_id || String(d.version_group_id.url || '').includes(`/version-group/`));
      const usable = details.filter(d => {
        const vg = d.version_group_id?.url;
        if (!vg) return true;
        return !generation || true;
      });
      const chosen = usable[0] || details[0] || null;
      const to = await speciesDisplayName(next.species.name);
      edges.push({ from, to, requirements: chosen ? requirementParts(chosen) : [] });
      edges.push(...await collectEvolution(next, generation));
    }
    return edges;
  };

  const evolutionData = async (species, generation) => {
    if (!species?.evolution_chain?.url) return { edges: [], summary: 'No evolution chain data available.' };
    const chain = await fetchEvolution(species.evolution_chain.url);
    const edges = await collectEvolution(chain.chain, generation);
    const summary = edges.length
      ? edges.map(edge => `${edge.from} evolves to ${edge.to}${edge.requirements.length ? ` at/by ${edge.requirements.join(', ')}` : ''}.`).join(' ')
      : `${await speciesDisplayName(species.name)} does not evolve.`;
    return { edges, summary };
  };

  const encounterMethod = name => ({
    walk: 'Tall Grass', surf: 'Surfing', 'old-rod': 'Old Rod', 'good-rod': 'Good Rod', 'super-rod': 'Super Rod',
    'rock-smash': 'Rock Smash', headbutt: 'Headbutt', 'dark-grass': 'Dark Grass', 'walking': 'Walking'
  }[name] || title(name || 'Unknown'));

  const locationName = async url => {
    try {
      const area = await get(url);
      const location = await get(area.location?.url || `location/${area.location?.name || ''}`);
      return location.names?.find(x => x.language?.name === 'en')?.name || title(location.name || area.name);
    } catch (_) { return title(String(url || '').split('/').filter(Boolean).pop() || 'Unknown'); }
  };

  const starterEntry = version => STARTERS[version]?.length ? STARTERS[version] : [];

  const locationsData = async (pokemon, game) => {
    const versions = versionNamesForGame(game);
    const encounters = await get(pokemon.location_area_encounters);
    const rows = [];
    for (const area of encounters || []) {
      const location = await locationName(area.location_area?.url);
      for (const detail of area.version_details || []) {
        const version = detail.version?.name;
        if (!versions.includes(version)) continue;
        for (const encounter of detail.encounter_details || []) {
          rows.push({
            game: VERSION_LABELS[version] || title(version),
            location,
            method: encounterMethod(encounter.method?.name),
            chance: encounter.chance ?? detail.max_chance ?? null,
            minLevel: encounter.min_level ?? null,
            maxLevel: encounter.max_level ?? null
          });
        }
      }
    }
    const speciesName = pokemon.species?.name || pokemon.name;
    for (const version of versions) {
      if (starterEntry(version).includes(speciesName)) rows.push({ game: VERSION_LABELS[version] || title(version), location: 'Starter', method: 'Starter Pokémon', chance: null, minLevel: null, maxLevel: null });
    }
    const unique = new Map();
    rows.forEach(row => {
      const key = JSON.stringify(row);
      if (!unique.has(key)) unique.set(key, row);
    });
    return [...unique.values()];
  };

  const heldItemsData = (pokemon, game) => {
    const versions = versionNamesForGame(game);
    const rows = [];
    for (const held of pokemon.held_items || []) {
      const details = (held.version_details || []).filter(x => versions.includes(x.version?.name));
      if (!details.length) continue;
      const rarity = Math.max(...details.map(x => x.rarity || 0));
      rows.push({ item: title(held.item?.name), rarity: rarity || null });
    }
    return rows;
  };

  const typeRelationsForGeneration = async (typeName, generation) => {
    const data = await get(`type/${typeName}`);
    const target = GENERATIONS[generation]?.[0];
    const historical = (data.past_damage_relations || []).filter(x => x.generation?.name === target)[0];
    return historical?.damage_relations || data.damage_relations;
  };

  const damageTakenData = async (types, generation) => {
    const generationData = await get(`generation/${generation}`);
    const allowedTypes = new Set((generationData.types || []).map(x => x.name));
    const attackingTypes = [...allowedTypes];
    const buckets = { '2x': [], '1x': [], '0.5x': [], '0x': [] };
    const relations = await Promise.all(attackingTypes.map(async name => [name, await typeRelationsForGeneration(name, generation)]));
    for (const [attackName, relation] of relations) {
      let multiplier = 1;
      for (const defend of types) {
        const def = String(defend).toLowerCase();
        if (relation.no_damage_from?.some(x => x.name === def)) multiplier *= 0;
        else if (relation.half_damage_from?.some(x => x.name === def)) multiplier *= 0.5;
        else if (relation.double_damage_from?.some(x => x.name === def)) multiplier *= 2;
      }
      if (multiplier === 0) buckets['0x'].push(title(attackName));
      else if (multiplier === 0.5) buckets['0.5x'].push(title(attackName));
      else if (multiplier === 2) buckets['2x'].push(title(attackName));
      else if (multiplier === 1) buckets['1x'].push(title(attackName));
      else buckets[multiplier > 1 ? '2x' : '0.5x'].push(`${title(attackName)} (${multiplier}×)`);
    }
    return buckets;
  };

  const getPokemonInfo = async ({ pokemon, game }) => {
    const generation = generationForGame(game);
    if (!generation) throw new Error(`Unsupported Pokédex game: ${game}`);
    const [apiPokemon, species] = await Promise.all([
      fetchPokemon(pokemon.baseName || pokemon.name, pokemon.form),
      fetchSpecies((pokemon.speciesId || pokemon.baseName || pokemon.name).toLowerCase())
    ]);
    const [evolution, locations, damageTaken] = await Promise.all([
      evolutionData(species, generation),
      locationsData(apiPokemon, game),
      damageTakenData((apiPokemon.types || []).sort((a,b) => a.slot - b.slot).map(x => x.type.name), generation)
    ]);
    const types = (apiPokemon.types || []).sort((a,b) => a.slot - b.slot).map(x => title(x.type.name));
    return {
      pokemon: {
        name: species.names?.find(x => x.language?.name === 'en')?.name || title(species.name),
        regionalDex: pokemon.num || '',
        nationalDex: apiPokemon.id,
        types
      },
      evolution,
      locations,
      details: {
        eggSteps: generation === 5 || generation === 6 ? (species.hatch_counter + 1) * 257 : (species.hatch_counter + 1) * 256,
        captureRate: species.capture_rate,
        damageTaken,
        wildHoldItems: heldItemsData(apiPokemon, game)
      }
    };
  };

  const showLoading = card => {
    const panel = window.JASPER_POKEDEX_UI?.open ? window.JASPER_POKEDEX_UI.open(card) : null;
    const body = document.getElementById('pokedexDetailBody');
    if (body) body.innerHTML = '<strong>Loading Pokédex data…</strong>';
    return panel;
  };

  const render = data => {
    const body = document.getElementById('pokedexDetailBody');
    if (!body) return;
    const damage = Object.entries(data.details.damageTaken).map(([key, values]) => `<div><strong>${key} Damage:</strong> ${values.length ? values.map(esc).join(', ') : 'None'}</div>`).join('');
    const locations = data.locations.length
      ? data.locations.map(x => `<li><strong>[${esc(x.game)}]</strong> ${esc(x.location)} — ${esc(x.method)}${x.chance != null ? ` — ${x.chance}%` : ''}${x.minLevel != null ? ` — Lv. ${x.minLevel}${x.maxLevel !== x.minLevel ? `–${x.maxLevel}` : ''}` : ''}</li>`).join('')
      : '<li>No wild/starter availability returned for this game group.</li>';
    const holds = data.details.wildHoldItems.length
      ? data.details.wildHoldItems.map(x => `<li>${esc(x.item)}${x.rarity != null ? ` — ${x.rarity}%` : ''}</li>`).join('')
      : '<li>None reported</li>';
    body.innerHTML = `
      <section><strong>Pokémon</strong><br>Pokémon: ${esc(data.pokemon.name)}<br>Regional Dex Number: #${esc(data.pokemon.regionalDex)}<br>National Dex Number: #${esc(data.pokemon.nationalDex)}<br>Type: ${data.pokemon.types.map(esc).join(' / ')}</section>
      <section><strong>Evolutionary Chain</strong><br>${esc(data.evolution.summary)}</section>
      <section><strong>Wild Locations</strong><ul>${locations}</ul></section>
      <section><strong>Additional Information</strong><br>Base Egg Steps: ${esc(data.details.eggSteps)}<br>Capture Rate: ${esc(data.details.captureRate)}<br>${damage}<br>Wild Hold Items:<ul>${holds}</ul></section>`;
  };

  const start = () => {
    if (window.__JASPER_POKEAPI_BOUND) return;
    window.__JASPER_POKEAPI_BOUND = true;
    document.addEventListener('click', async event => {
      const button = event.target.closest?.('.pokemon-card .pokedex-button');
      if (!button) return;
      const card = button.closest('.pokemon-card');
      if (!card) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const game = window.JASPER_ACTIVE_GAME || 'pokemon-white-2';
      const detail = {
        id: card.dataset.id || '',
        name: card.dataset.name || '',
        baseName: card.dataset.name || '',
        form: card.dataset.form || '',
        speciesId: card.dataset.speciesId || '',
        num: card.dataset.num || ''
      };
      const parsed = String(detail.name).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (parsed) { detail.baseName = parsed[1].trim(); detail.form = parsed[2].trim(); }
      showLoading(card);
      try {
        const data = await getPokemonInfo({ pokemon: detail, game });
        render(data);
        window.JASPER_POKEDEX_DETAIL = { ...detail, game, data };
      } catch (error) {
        const body = document.getElementById('pokedexDetailBody');
        if (body) body.innerHTML = `<strong>Pokédex data unavailable.</strong><br>${esc(error.message)}<br><br>The core collection remains available; API data will retry when you open this entry again.`;
      }
    }, true);
  };

  window.JASPER_POKEAPI = { getPokemonInfo, clearCache: () => { cache.clear(); localStorage.removeItem(CACHE_KEY); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
