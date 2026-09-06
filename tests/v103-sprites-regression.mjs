import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const version=read('version.js');
const sprites=read('sprite-card-v103.js');
assert.match(version,/JASPER_POKEDEX_VERSION\s*=\s*['"]Release v1\.0\.3['"]/);
assert.match(version,/sprite-card-v103\.js/);
assert.match(sprites,/\['basculin\|red',\s*'basculin'\]/);
assert.match(sprites,/\['basculin\|blue',\s*'basculin-blue-striped'\]/);
assert.match(sprites,/\['raichu\|alolan',\s*'raichu-alola'\]/);
assert.match(sprites,/fetch\(`Sprites\/\$\{encodeURIComponent\(candidate\)\}\.png`/);
// Desktop contract remains unchanged.
assert.match(sprites,/min-width:180px/); assert.match(sprites,/height:78px/); assert.match(sprites,/width:136px;height:112px/); assert.match(sprites,/right:-17px;top:-41px/);
// Compact/mobile contract.
assert.match(sprites,/@container pokemon-grid \(max-width:1109px\)/); assert.match(sprites,/width:100%;min-width:110px;max-width:179px;height:80px;min-height:80px/); assert.match(sprites,/width:68px;height:56px;left:21px;right:auto;top:1px/); assert.match(sprites,/pokemon-dex-num\{position:absolute;left:0;bottom:0/); assert.match(sprites,/pokemon-form\{position:absolute;right:0;bottom:0/);
// Destructive Bulk Mode state remains red after completed is removed.
assert.match(sprites,/\.cell\.pokemon-card\.completed\.bulk-pending/); assert.match(sprites,/\.cell\.pokemon-card\.bulk-remove-pending/); assert.match(sprites,/was===true&&!now&&pending/); assert.match(sprites,/#3D1C1C/); assert.match(sprites,/#6C2A2A/); assert.match(sprites,/\.pokemon-card \.checkbox\{display:none!important\}/);
assert.match(sprites,/window\.JASPER_SPRITES=\{resolve,apply:applySprite\}/);
for(const asset of ['Sprites/absol.png','Sprites/absol-mega.png','Sprites/basculin.png','Sprites/basculin-blue-striped.png','Sprites/raichu-alola.png'])assert.ok(fs.existsSync(asset),`Missing expected sprite asset: ${asset}`);
const pngCount=fs.readdirSync('Sprites').filter(n=>n.toLowerCase().endsWith('.png')).length; assert.ok(pngCount>=1000,`Unexpectedly low sprite asset count: ${pngCount}`);
console.log(`v1.0.3 sprite regression checks passed (${pngCount} PNG assets).`);
