import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const save = fs.readFileSync('save.json', 'utf8');

const cells = [...html.matchAll(/<div class="cell"(?=[^>]*\bdata-id=")([^>]*)>/g)]
  .map(match => match[1]);

const ids = cells.map(attrs => attrs.match(/\bdata-id="([^"]+)"/)?.[1]).filter(Boolean);
const emptyCells = [...html.matchAll(/<div class="cell empty">/g)].length;
const nonEmptyCount = ids.length;

assert.equal(nonEmptyCount, 315, `Expected 315 boxable entries including forms; found ${nonEmptyCount}`);
assert.equal(new Set(ids).size, 315, 'Every boxable entry must have a unique data-id');
assert.equal(emptyCells, 15, `Expected 15 empty Box 11 slots; found ${emptyCells}`);

const requiredForms = [
  '297-Normal', '297-Black', '297-White',
  '298-Ordinary', '298-Resolute',
  '300-NoDrive', '300-Burn', '300-Shock', '300-Chill', '300-Douse'
];
for (const id of requiredForms) {
  assert.ok(ids.includes(id), `Missing required boxable form: ${id}`);
}

for (const forbidden of ['Thundurus (Incarnate)', 'Thundurus (Therian)', 'Tornadus (Incarnate)', 'Tornadus (Therian)', 'Landorus (Incarnate)', 'Landorus (Therian)']) {
  assert.equal(html.includes(`data-name="${forbidden}"`), false, `Unexpected non-target form remains: ${forbidden}`);
}

assert.ok(html.includes('<script src="stabilization-v094.js?v=0.9.4"></script>'), 'Stabilization layer is not loaded');
assert.ok(html.indexOf('stabilization-v094.js') < html.indexOf('github-sync.js'), 'Stabilization must load before GitHub sync');

const saveObject = JSON.parse(save);
assert.equal(saveObject.version, 1, 'save.json version changed unexpectedly');
assert.ok(saveObject.pokemon && typeof saveObject.pokemon === 'object', 'save.json pokemon state is missing');

console.log(`PASS: ${nonEmptyCount} boxable entries, ${emptyCells} empty slots, protected forms present, save.json readable.`);
