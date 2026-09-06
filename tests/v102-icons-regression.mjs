import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const engine = read('pokedex-engine.js');
const theme = read('theme-toggle.js');
const mobile = read('mobile-overhaul-v133.js');
const sync = read('github-sync.js');
const boot = read('beta071.js');
const base = read('beta071-base.js');
const icons = read('icon-system.js');

for (const file of [
  'Icons/box-fill.svg',
  'Icons/list-fill.svg',
  'Icons/check-fill.svg',
  'Icons/empty-circle.svg',
  'Icons/clear-fill.svg',
  'Icons/info-fill.svg',
  'Icons/moon-fill.svg',
  'Icons/sun-fill.svg',
  'Icons/sync-token-needed.svg',
  'Icons/sync-inprogress-fill.svg',
  'Icons/sync-warn-fill.svg'
]) assert.ok(fs.existsSync(file), `Missing icon asset: ${file}`);

assert.match(boot, /load\('icon-system\.js'/);
assert.match(icons, /window\.JASPER_ICONS/);
assert.match(icons, /if \(target\.isConnected\) target\.replaceWith\(svg\)/);
assert.match(icons, /target\.replaceWith\(holder\);\s*return;/);
assert.match(engine, /data-icon="box-fill"/);
assert.match(engine, /data-icon="list-fill"/);
assert.match(engine, /data-icon="\$\{completed\?'check-fill':'empty-circle'\}"/);
assert.match(engine, /const checkbox=\(completed=false\)/);
assert.match(engine, /data-icon="clear-fill"/);
assert.match(engine, /data-icon="info-fill"/);
assert.doesNotMatch(engine, /b\.innerHTML='<svg/);
assert.doesNotMatch(engine, /l\.innerHTML='<svg/);
assert.doesNotMatch(engine, /textContent='×'/);
assert.doesNotMatch(engine, /<svg viewBox=/);

assert.match(theme, /moon-fill/);
assert.match(theme, /sun-fill/);
assert.doesNotMatch(theme, /theme === 'dark' \? '☀'/);
assert.doesNotMatch(theme, /theme === 'dark' \? '☾'/);
assert.match(theme, /\.checkbox\s*,\.checkbox \*\s*,\.checkbox svg\{background-color:transparent!important/);
assert.match(theme, /\.bulk-pending \.checkbox.*background:transparent!important/);
assert.match(theme, /html\[data-theme="dark"\] #dexProgressBanner \.dex-progress-icon\{background:transparent!important;color:#475569!important/);

assert.match(mobile, /data-icon="moon-fill"/);
assert.match(mobile, /data-icon="info-fill"/);
assert.doesNotMatch(mobile, /Dark mode unavailable on Mobile[^<]*>☾</);
assert.doesNotMatch(mobile, /mobile-progress-icon">i</);

assert.match(sync, /sync-token-needed/);
assert.match(sync, /sync-inprogress-fill/);
assert.match(sync, /sync-warn-fill/);
assert.match(sync, /id='githubSyncPill'/);
assert.match(sync, /window\.dispatchEvent\(new CustomEvent\('jasper:sync-ui-ready'\)\)/);
assert.match(sync, /#githubSyncWrap\{.*display:block!important;visibility:visible!important/);
assert.doesNotMatch(sync, /i\.textContent=type==='ok'\?'✓'/);
assert.doesNotMatch(sync, /i\.textContent=type==='busy'\?'↻'/);
assert.match(base, /jasper:sync-ui-ready/);
assert.match(base, /placeSync\(\)/);

assert.match(read('Icons/check-fill.svg'), /fill="currentColor"/);
assert.match(read('Icons/empty-circle.svg'), /fill="currentColor"/);
assert.match(read('Icons/info-fill.svg'), /fill="currentColor"/);
assert.match(read('Icons/clear-fill.svg'), /fill="currentColor"/);

assert.match(engine, /BOX_SIZE=30,BOX_COLUMNS=6,BOX_ROWS=5/);
assert.match(engine, /while\(grid\.children\.length<BOX_SIZE\)/);

console.log('v1.0.2 icon regression checks passed.');
