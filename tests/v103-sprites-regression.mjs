import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const version = read('version.js');
const sprites = read('sprite-card-v103.js');

assert.match(version, /JASPER_POKEDEX_VERSION\s*=\s*['"]Release v1\.0\.3['"]/);
assert.match(version, /sprite-card-v103\.js/);

// Resolver: explicit form exceptions must win over filename inference.
assert.match(sprites, /\['basculin\|red',\s*'basculin'\]/);
assert.match(sprites, /\['basculin\|blue',\s*'basculin-blue-striped'\]/);
assert.match(sprites, /\['raichu\|alolan',\s*'raichu-alola'\]/);
assert.match(sprites, /fetch\(`Sprites\/\$\{encodeURIComponent\(candidate\)\}\.png`/);

// Desktop card contract.
assert.match(sprites, /min-width:180px/);
assert.match(sprites, /height:78px/);
assert.match(sprites, /width:136px;height:112px/);
assert.match(sprites, /right:-17px;top:-41px/);

// Compact/mobile card contract.
assert.match(sprites, /width:110px;min-width:110px;max-width:110px/);
assert.match(sprites, /height:68px/);
assert.match(sprites, /width:68px;height:56px/);
assert.match(sprites, /left:21px;right:auto;top:1px/);

// Completion state remains data-driven; the old visual checkbox is presentation-only.
assert.match(sprites, /\.pokemon-card \\.checkbox\{display:none!important\}/);
assert.match(sprites, /completed\.bulk-pending\{background-color:#3D1C1C!important;border-color:#6C2A2A!important\}/);

// Canonical sprite presentation boundary is exposed for future engine integration/tests.
assert.match(sprites, /window\.JASPER_SPRITES=\{resolve,apply:applySprite\}/);

const expectedAssets = [
  'Sprites/absol.png',
  'Sprites/absol-mega.png',
  'Sprites/basculin.png',
  'Sprites/basculin-blue-striped.png',
  'Sprites/raichu-alola.png'
];
for (const asset of expectedAssets) assert.ok(fs.existsSync(asset), `Missing expected sprite asset: ${asset}`);

const pngCount = fs.readdirSync('Sprites').filter(name => name.toLowerCase().endsWith('.png')).length;
assert.ok(pngCount >= 1000, `Unexpectedly low sprite asset count: ${pngCount}`);

console.log(`v1.0.3 sprite regression checks passed (${pngCount} PNG assets).`);
