/*
 * Run with:  node --test tests/app.test.mjs
 *
 * These tests exercise the real modules and the real data files. They need
 * no browser and no network.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BOX_SIZE, changedIds, damageTaken, migrateState, parseDex, pickPast, placeholderArt, progress,
  safeStorage, sameState, searchEntries, slug, spriteCandidates, toBoxes, typesForGeneration
} from '../js/core.js';
import { familyFor, pickEvolutionDetails } from '../js/pokedex.js';
import { createSync, detectRepo } from '../js/sync.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const registry = JSON.parse(read('data/games.json'));
const enabledGames = registry.games.filter(game => game.enabled);
const dexOf = game => parseDex(read(`Pokedexes/${game.dex}`));

// Entries that are known to have no artwork yet. They show placeholder art.
const KNOWN_MISSING_SPRITES = new Set(['falinks']);

/* ---------- dataset ---------- */

test('parseDex reads table rows and builds stable ids', () => {
  const entries = parseDex([
    '# Heading',
    '| # | Pokémon (form if applicable) |',
    '|---|---|',
    '| #016 | Unfezant (Male) |',
    '| #16 | Unfezant (Female) |',
    '| #038 | Flabébé |',
    '| 203 | Type: Null |'
  ].join('\n'));
  assert.deepEqual(entries.map(entry => entry.id), ['016-unfezant-male', '016-unfezant-female', '038-flabebe', '203-type-null']);
  assert.deepEqual(entries[0], { id: '016-unfezant-male', num: '016', name: 'Unfezant (Male)', baseName: 'Unfezant', form: 'Male', speciesId: 'unfezant' });
  assert.equal(entries[2].form, '');
});

test('slug does not depend on the device language', () => {
  assert.equal(slug('MIMIKYU'), 'mimikyu');
  assert.equal(slug('Flabébé'), 'flabebe');
});

test('the registry is consistent with the files in the repo', () => {
  assert.ok(registry.games.some(game => game.id === registry.defaultGame && game.enabled), 'default game is enabled');
  assert.ok(enabledGames.length > 0);
  const ids = registry.games.map(game => game.id);
  assert.equal(new Set(ids).size, ids.length, 'game ids are unique');
  const saves = enabledGames.map(game => game.save);
  assert.equal(new Set(saves).size, saves.length, 'enabled games save to different files');
  for (const game of registry.games.filter(item => item.visible)) {
    assert.ok(exists(`Game Icons/${game.icon}`), `${game.id}: Game Icons/${game.icon} exists`);
  }
});

for (const game of enabledGames) {
  test(`${game.id}: dataset parses, ids are unique, boxes hold ${BOX_SIZE}`, () => {
    assert.ok(exists(`Pokedexes/${game.dex}`), `Pokedexes/${game.dex} exists`);
    const entries = dexOf(game);
    assert.ok(entries.length > 0);
    assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length, 'no duplicate entry ids');
    const boxes = toBoxes(entries);
    assert.equal(boxes.length, Math.ceil(entries.length / BOX_SIZE));
    assert.ok(boxes.every(box => box.items.length <= BOX_SIZE));
    assert.equal(boxes.reduce((n, box) => n + box.items.length, 0), entries.length);
  });

  test(`${game.id}: every entry resolves to a sprite on the first try`, () => {
    const misses = [];
    for (const entry of dexOf(game)) {
      const [first] = spriteCandidates(entry.baseName, entry.form);
      if (!exists(`Sprites/${first}.png`) && !KNOWN_MISSING_SPRITES.has(first)) misses.push(`${entry.name} -> Sprites/${first}.png`);
    }
    assert.deepEqual(misses, []);
  });

  test(`${game.id}: the committed save only uses known entry ids`, () => {
    if (!game.save || !exists(game.save)) return;
    const save = JSON.parse(read(game.save));
    assert.equal(save.gameId, game.id);
    const entries = dexOf(game);
    const kept = migrateState(entries, save.pokemon);
    assert.deepEqual(Object.keys(save.pokemon).filter(key => !(key in kept)), [], 'no orphaned keys');
  });
}

test('toBoxes always returns at least one box', () => {
  assert.equal(toBoxes([]).length, 1);
  assert.deepEqual(toBoxes([]).at(0).items, []);
});

/* ---------- state ---------- */

test('migrateState accepts every key shape older releases wrote', () => {
  const entries = parseDex(read('Pokedexes/White2'));
  const migrated = migrateState(entries, {
    '000': true,                 // dex number only
    '016-M': true,               // compact gender key
    '016-1': false,              // second entry sharing a number
    '104-Blue': true,            // number + form
    '159-Summer': true,
    '001-snivy': true,           // current id
    '999': true,                 // unknown: dropped
    '002': 'yes'                 // non-boolean: coerced to false
  });
  assert.deepEqual(migrated, {
    '000-victini': true,
    '016-unfezant-male': true,
    '016-unfezant-female': false,
    '104-basculin-blue': true,
    '159-deerling-summer': true,
    '001-snivy': true,
    '002-servine': false
  });
});

test('the legacy save.json still maps onto White 2', () => {
  const entries = parseDex(read('Pokedexes/White2'));
  const legacy = JSON.parse(read('save.json')).pokemon;
  const migrated = migrateState(entries, legacy);
  const valid = new Set(entries.map(entry => entry.id));
  assert.ok(Object.keys(migrated).length > 150);
  assert.ok(Object.keys(migrated).every(id => valid.has(id)));
});

test('progress, sameState and changedIds', () => {
  const entries = parseDex('| #001 | A |\n| #002 | B |\n| #003 | C |');
  assert.deepEqual(progress(entries, { '001-a': true, '002-b': false }), { done: 1, total: 3, remaining: 2, percent: 33 });
  assert.equal(sameState({ a: true, b: false }, { a: true }), true);
  assert.equal(sameState({ a: true }, { a: false }), false);
  assert.deepEqual(changedIds({ a: true, b: false, c: true }, { a: true, b: true }).sort(), ['b', 'c']);
});

test('safeStorage survives missing or failing storage', () => {
  const broken = safeStorage(null);
  assert.equal(broken.get('x'), null);
  assert.equal(broken.set('x', '1'), false);
  assert.deepEqual(broken.json('x', { fallback: true }), { fallback: true });
  broken.remove('x');
});

/* ---------- search and sprites ---------- */

test('search ranks exact number, then name prefix, then partial matches', () => {
  const entries = parseDex(read('Pokedexes/White2'));
  assert.equal(searchEntries(entries, '16')[0].num, '016');
  assert.equal(searchEntries(entries, '#016')[0].num, '016');
  assert.deepEqual(searchEntries(entries, 'unf').slice(0, 2).map(entry => entry.id), ['016-unfezant-male', '016-unfezant-female']);
  assert.equal(searchEntries(entries, 'flabebe').length, 0);
  assert.equal(searchEntries(parseDex('| #038 | Flabébé |'), 'flabebe').length, 1, 'accents are ignored');
  assert.deepEqual(searchEntries(entries, '   '), []);
  assert.ok(searchEntries(entries, 'a', 10).length <= 10);
});

test('spriteCandidates knows default forms, Alolan forms and aliases', () => {
  assert.deepEqual(spriteCandidates('Unfezant', 'Male'), ['unfezant']);
  assert.deepEqual(spriteCandidates('Unfezant', 'Female'), ['unfezant-female', 'unfezant']);
  assert.deepEqual(spriteCandidates('Vulpix', 'Alolan')[0], 'vulpix-alola');
  assert.deepEqual(spriteCandidates('Basculin', 'Blue')[0], 'basculin-blue-striped');
  assert.deepEqual(spriteCandidates('Oricorio', "Pa'u")[0], 'oricorio-pau');
  assert.deepEqual(spriteCandidates('Type: Null'), ['type-null']);
});

test('placeholderArt is deterministic and a valid data URI', () => {
  const art = placeholderArt('212-falinks');
  assert.equal(art, placeholderArt('212-falinks'));
  assert.notEqual(art, placeholderArt('001-snivy'));
  assert.match(decodeURIComponent(art), /^data:image\/svg\+xml,<svg [^>]*viewBox="0 0 68 56"/);
});

/* ---------- type matchups ---------- */

const types = names => names.map(name => ({ name }));
const NORMAL = { name: 'normal', damage_relations: { no_damage_from: types(['ghost']), half_damage_from: [], double_damage_from: types(['fighting']) } };
const FLYING = { name: 'flying', damage_relations: { no_damage_from: types(['ground']), half_damage_from: types(['fighting', 'bug', 'grass']), double_damage_from: types(['rock', 'electric', 'ice']) } };
const STEEL = {
  name: 'steel',
  damage_relations: { no_damage_from: types(['poison']), half_damage_from: types(['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy']), double_damage_from: types(['fire', 'fighting', 'ground']) },
  past_damage_relations: [{
    generation: { name: 'generation-v' },
    damage_relations: { no_damage_from: types(['poison']), half_damage_from: types(['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel']), double_damage_from: types(['fire', 'fighting', 'ground']) }
  }]
};

test('damageTaken multiplies the defender\'s types (Normal/Flying)', () => {
  const groups = Object.fromEntries(damageTaken([NORMAL, FLYING], 5).map(group => [group.multiplier, group.types]));
  assert.deepEqual(groups[2], ['electric', 'ice', 'rock']);
  assert.deepEqual(groups[0.5], ['grass', 'bug']);
  assert.deepEqual(groups[0], ['ground', 'ghost']);
  assert.equal(Object.values(groups).flat().includes('fighting'), false, '2× and ½× cancel out to neutral');
});

test('damageTaken uses the rules of the game\'s generation', () => {
  const half = generation => damageTaken([STEEL], generation).find(group => group.multiplier === 0.5).types;
  assert.ok(half(5).includes('ghost') && half(5).includes('dark'), 'Steel resisted Ghost and Dark through generation 5');
  assert.ok(!half(6).includes('ghost') && half(6).includes('fairy'));
  assert.equal(typesForGeneration(5).includes('fairy'), false);
  assert.equal(typesForGeneration(6).includes('fairy'), true);
});

test('pickPast returns the earliest past rule that still applied', () => {
  const past = [{ generation: { name: 'generation-i' }, types: 'gen1' }, { generation: { name: 'generation-v' }, types: 'gen5' }];
  assert.equal(pickPast(past, 1, 'types'), 'gen1');
  assert.equal(pickPast(past, 4, 'types'), 'gen5');
  assert.equal(pickPast(past, 6, 'types'), null);
  assert.equal(pickPast(undefined, 5, 'types'), null);
});

/* ---------- Pokédex details ---------- */

test('pickEvolutionDetails keeps the method for this form and generation', () => {
  // Darumaka -> Darmanitan, as PokéAPI returns it.
  const darumaka = [
    { min_level: 35, item: null, region: null, required_pokemon_form: null, evolved_pokemon_form: null, version_group: { name: 'black-white' } },
    { min_level: null, item: { name: 'ice-stone' }, region: null, required_pokemon_form: { name: 'darumaka-galar' }, evolved_pokemon_form: { name: 'darmanitan-galar-standard' }, version_group: { name: 'sword-shield' } }
  ];
  assert.deepEqual(pickEvolutionDetails(darumaka, { form: '', generation: 5 }).map(d => d.min_level), [35]);
  assert.deepEqual(pickEvolutionDetails(darumaka, { form: 'galarian', generation: 8 }).map(d => d.item?.name), ['ice-stone']);

  // Eevee -> Leafeon: a rock per region, and a Leaf Stone from generation 8.
  const leafeon = [
    { location: { name: 'eterna-forest' }, version_group: { name: 'diamond-pearl' } },
    { location: { name: 'pinwheel-forest' }, version_group: { name: 'black-white' } },
    { location: { name: 'kalos-route-20' }, version_group: { name: 'x-y' } },
    { item: { name: 'leaf-stone' }, version_group: { name: 'sword-shield' } }
  ];
  assert.deepEqual(pickEvolutionDetails(leafeon, { generation: 5 }).map(d => d.location?.name), ['pinwheel-forest']);
  assert.equal(pickEvolutionDetails(leafeon, { generation: 0 }).length, 4, 'unknown generation keeps everything');
  assert.deepEqual(pickEvolutionDetails([{ min_level: 16 }], { generation: 5 }), [{ min_level: 16 }]);
  assert.deepEqual(pickEvolutionDetails(undefined), []);
});

test('familyFor maps a game to its generation and versions', () => {
  assert.equal(familyFor('pokemon-white-2').generation, 5);
  assert.ok(familyFor('pokemon-alpha-sapphire').versions.includes('alpha-sapphire'));
  assert.equal(familyFor('pokemon-legends-z-a'), null);
});

/* ---------- GitHub sync ---------- */

const memoryStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return safeStorage({ getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) });
};
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const encodeSave = save => Buffer.from(JSON.stringify(save), 'utf8').toString('base64');

function syncHarness({ token = 'tkn', responses }) {
  const storage = memoryStorage(token ? { jasper_pokedex_github_token: token } : {});
  const calls = [];
  const statuses = [];
  let local = {};
  const sync = createSync({
    savePath: game => `saves/${game}.json`,
    entries: async () => parseDex('| #001 | Snivy |\n| #016 | Unfezant (Male) |'),
    getState: () => local,
    applyRemote: (game, state) => { local = state; },
    onStatus: status => statuses.push(status.state)
  }, {
    storage,
    location: { hostname: 'localhost', pathname: '/' },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET', headers: options.headers, body: options.body ? JSON.parse(options.body) : null });
      return responses(url, options);
    }
  });
  return { sync, storage, calls, statuses, local: () => local, setLocal: value => { local = value; } };
}

test('detectRepo follows GitHub Pages and falls back to the main repository', () => {
  assert.deepEqual(detectRepo({ hostname: 'someone.github.io', pathname: '/Jasper-Pokedex/index.html' }), { owner: 'someone', name: 'Jasper-Pokedex', branch: 'main' });
  assert.deepEqual(detectRepo({ hostname: 'localhost', pathname: '/' }), { owner: 'lingjasper', name: 'Jasper-Pokedex', branch: 'main' });
  assert.deepEqual(detectRepo({ hostname: 'someone.github.io', pathname: '/index.html' }).owner, 'lingjasper');
});

test('sync.load without a token does not call GitHub', async () => {
  const h = syncHarness({ token: '', responses: () => { throw new Error('no request expected'); } });
  assert.equal(await h.sync.load('pokemon-sun'), false);
  assert.deepEqual(h.statuses, ['none']);
  assert.equal(h.calls.length, 0);
});

test('sync.load migrates the remote save and remembers its SHA', async () => {
  const h = syncHarness({ responses: () => reply(200, { sha: 'abc', content: encodeSave({ pokemon: { '016-M': true, '001': false }, updatedAt: '2026-11-01T00:00:00.000Z' }) }) });
  assert.equal(await h.sync.load('pokemon-sun'), true);
  assert.deepEqual(h.local(), { '016-unfezant-male': true, '001-snivy': false });
  assert.equal(h.storage.get('jasper_pokedex_save_sha_pokemon-sun'), 'abc');
  assert.equal(h.calls[0].url, 'https://api.github.com/repos/lingjasper/Jasper-Pokedex/contents/saves/pokemon-sun.json?ref=main');
  assert.equal(h.calls[0].headers.Authorization, 'Bearer tkn');
  assert.deepEqual(h.statuses, ['busy', 'ok']);
});

test('sync.save writes the documented payload with the loaded SHA', async () => {
  const h = syncHarness({ responses: (url, options) => (options.method === 'PUT' ? reply(200, { content: { sha: 'def' } }) : reply(200, { sha: 'abc', content: encodeSave({ pokemon: {} }) })) });
  await h.sync.load('pokemon-sun');
  h.setLocal({ '001-snivy': true });
  assert.equal(await h.sync.save('pokemon-sun'), true);
  const put = h.calls.at(-1);
  assert.equal(put.method, 'PUT');
  assert.equal(put.body.sha, 'abc');
  assert.equal(put.body.branch, 'main');
  assert.equal(put.body.message, 'Update pokemon-sun Pokedex progress');
  const saved = JSON.parse(Buffer.from(put.body.content, 'base64').toString('utf8'));
  assert.deepEqual(Object.keys(saved), ['version', 'gameId', 'updatedAt', 'pokemon']);
  assert.deepEqual(saved.pokemon, { '001-snivy': true });
  assert.equal(h.storage.get('jasper_pokedex_save_sha_pokemon-sun'), 'def');
});

test('a conflict keeps the stale SHA and the local state', async () => {
  const h = syncHarness({ responses: (url, options) => (options.method === 'PUT' ? reply(409, { message: 'conflict' }) : reply(200, { sha: 'abc', content: encodeSave({ pokemon: {} }) })) });
  await h.sync.load('pokemon-sun');
  h.setLocal({ '001-snivy': true });
  assert.equal(await h.sync.save('pokemon-sun'), false);
  assert.equal(h.statuses.at(-1), 'error');
  assert.equal(h.storage.get('jasper_pokedex_save_sha_pokemon-sun'), 'abc');
  assert.deepEqual(h.local(), { '001-snivy': true });
});

test('an invalid token is forgotten, local progress is not', async () => {
  const h = syncHarness({ responses: () => reply(401, { message: 'Bad credentials' }) });
  h.setLocal({ '001-snivy': true });
  assert.equal(await h.sync.load('pokemon-sun'), false);
  assert.equal(h.sync.hasToken(), false);
  assert.deepEqual(h.local(), { '001-snivy': true });
});

test('White 2 falls back to the legacy save.json and writes the per-game file', async () => {
  const h = syncHarness({
    responses: (url, options) => {
      if (options.method === 'PUT') return reply(200, { content: { sha: 'new' } });
      if (url.includes('/contents/save.json')) return reply(200, { sha: 'old', content: encodeSave({ pokemon: { '001': true } }) });
      return reply(404, { message: 'Not Found' });
    }
  });
  assert.equal(await h.sync.load('pokemon-white-2'), true);
  assert.deepEqual(h.local(), { '001-snivy': true });
  const put = h.calls.find(call => call.method === 'PUT');
  assert.ok(put.url.endsWith('/contents/saves/pokemon-white-2.json'));
  assert.equal(put.body.sha, undefined, 'the new file is created, not updated');
});

/* ---------- shell ---------- */

test('index.html only references files and icons that exist', () => {
  const html = read('index.html');
  const sources = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(match => match[1]);
  assert.ok(sources.includes('app.css') && sources.includes('js/app.js'));
  for (const file of sources) assert.ok(exists(file), `${file} exists`);

  const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]));
  const used = [...(html + read('js/app.js')).matchAll(/#(i-[a-z-]+)/g)].map(match => match[1]);
  for (const id of used) assert.ok(symbols.has(id), `icon ${id} is defined`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'element ids are unique');
  for (const id of [...read('js/app.js').matchAll(/\$\('([^']+)'\)/g)].map(match => match[1])) {
    assert.ok(ids.includes(id), `#${id} exists in index.html`);
  }
});
