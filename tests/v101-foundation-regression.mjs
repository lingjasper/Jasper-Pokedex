import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const registry = JSON.parse(fs.readFileSync('data/games.json', 'utf8'));
assert.equal(registry.schemaVersion, 1);
assert.equal(registry.defaultGame, 'pokemon-white-2');
assert.equal(new Set(registry.games.map(g => g.id)).size, registry.games.length, 'game IDs must be unique');
assert.equal(new Set(registry.games.map(g => g.save)).size, registry.games.length, 'save paths must be unique per game');
const white2 = registry.games.find(g => g.id === 'pokemon-white-2');
assert.ok(white2?.enabled, 'White 2 must remain enabled');
assert.equal(white2.dataset, 'White2');
assert.equal(white2.save, 'saves/pokemon-white-2.json');
assert.ok(registry.games.filter(g => g.enabled).every(g => g.save), 'every enabled game needs a save path');

const dataset = fs.readFileSync('Pokedexes/White2', 'utf8');
const rows = [...dataset.matchAll(/^\|\s*#?(\d+)\s*\|\s*(.*?)\s*\|\s*$/gm)].map(m => ({ num: m[1].padStart(3, '0'), name: m[2].trim() }));
assert.equal(rows.length, 311, 'White 2 dataset count changed unexpectedly');
assert.equal(new Set(rows.map(r => `${r.num}|${r.name}`)).size, rows.length, 'dataset contains duplicate entries');
assert.equal(new Set(rows.map(r => r.num)).size, 301, 'White 2 must retain 301 numbered Dex slots');
for (const num of ['016', '104', '159', '160', '180', '181']) {
  assert.equal(rows.filter(r => r.num === num).length, 2, `expected two boxable forms for ${num}`);
}
assert.equal(rows.filter(r => r.num === '297').length, 1, 'Kyurem must not gain unapproved forms in the dataset');
assert.equal(rows.filter(r => r.num === '298').length, 1, 'Keldeo must not gain unapproved forms in the dataset');
assert.equal(rows.filter(r => r.num === '300').length, 1, 'Genesect must not gain unapproved forms in the dataset');

const engine = fs.readFileSync('pokedex-engine.js', 'utf8');
assert.match(engine, /jasper_pokedex_state_/);
assert.match(engine, /pokemon-white-2/);
assert.match(engine, /gameRegistry/);
assert.match(engine, /activeGame/);

const base = fs.readFileSync('beta071-base.js', 'utf8');
assert.match(base, /jasper_pokedex_state_\$\{window\.JASPER_ACTIVE_GAME/);
assert.match(base, /jasper:pokedex-game-changed/);

const nationalCore = fs.readFileSync('national-dex-core.js', 'utf8');
const context = { window: {}, console };
vm.runInNewContext(nationalCore, context, { filename: 'national-dex-core.js' });
const dex = context.window.JASPER_NATIONAL_DEX;
assert.ok(dex, 'National Dex foundation API must load');
assert.equal(dex.schemaVersion, 1);
const aggregate = dex.aggregate([
  { gameId: 'pokemon-white-2', entries: [{ entryId: '025-pikachu', globalSpeciesId: 25, name: 'Pikachu' }], state: { '025-pikachu': true } },
  { gameId: 'pokemon-sun', entries: [{ entryId: '025-pikachu', globalSpeciesId: 25, name: 'Pikachu' }], state: { '025-pikachu': false } }
]);
assert.equal(aggregate.length, 1);
assert.deepEqual(aggregate[0].games.map(g => [g.gameId, g.obtained]), [
  ['pokemon-white-2', true],
  ['pokemon-sun', false]
]);
assert.deepEqual(dex.ownership(aggregate[0]), ['pokemon-white-2']);

console.log('v1.0.1 foundation regression passed.');
