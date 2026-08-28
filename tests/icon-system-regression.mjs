import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const iconDir = path.join(root, 'Icons');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readIcon = file => fs.readFileSync(path.join(iconDir, file), 'utf8');
const fail = message => { throw new Error(`[Icon System] ${message}`); };

const requiredFiles = [
  'box-fill.svg', 'box-outline.svg',
  'list-fill.svg', 'list-outline.svg',
  'empty-circle.svg', 'check-fill.svg', 'check-outline.svg',
  'search.svg', 'clear-outline.svg', 'clear-fill.svg',
  'moon-fill.svg', 'moon-outline.svg', 'sun-fill.svg', 'sun-outline.svg',
  'sync-inprogress-outline.svg', 'sync-inprogress-fill.svg',
  'sync-warn-outline.svg', 'sync-warn-fill.svg', 'sync-token-needed.svg',
  'bulk-mode-outline.svg', 'bulk-mode-fill.svg',
  'bulk-pending-outline.svg', 'bulk-pending-fill.svg',
  'info-outline.svg', 'info-fill.svg'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(iconDir, file))) fail(`Missing canonical asset: Icons/${file}`);
}

if (!fs.existsSync(path.join(iconDir, 'ICON_SYSTEM.md'))) fail('Missing Icons/ICON_SYSTEM.md.');
if (!fs.existsSync(path.join(root, 'icon-system.js'))) fail('Missing shared icon runtime: icon-system.js.');

const registry = read('icon-system.js');
const documentation = read('Icons/ICON_SYSTEM.md');

const expectedMappings = [
  ['box-fill.svg', 'box', 'selected'],
  ['box-outline.svg', 'box', 'unselected'],
  ['list-fill.svg', 'list', 'selected'],
  ['list-outline.svg', 'list', 'unselected'],
  ['empty-circle.svg', 'completion', 'unchecked'],
  ['check-fill.svg', 'completion', 'checked'],
  ['search.svg', 'search', 'default'],
  ['clear-outline.svg', 'clear', 'default'],
  ['clear-fill.svg', 'clear', 'active'],
  ['moon-outline.svg', 'theme', 'light'],
  ['moon-fill.svg', 'theme', 'light'],
  ['sun-outline.svg', 'theme', 'dark'],
  ['sun-fill.svg', 'theme', 'dark'],
  ['sync-inprogress-outline.svg', 'sync', 'inProgress'],
  ['sync-inprogress-fill.svg', 'sync', 'inProgress'],
  ['sync-warn-outline.svg', 'sync', 'warning'],
  ['sync-warn-fill.svg', 'sync', 'warning'],
  ['sync-token-needed.svg', 'sync', 'tokenNeeded'],
  ['bulk-mode-outline.svg', 'bulkMode', 'default'],
  ['bulk-mode-fill.svg', 'bulkMode', 'active'],
  ['bulk-pending-outline.svg', 'bulkPending', 'default'],
  ['bulk-pending-fill.svg', 'bulkPending', 'active'],
  ['info-outline.svg', 'info', 'default'],
  ['info-fill.svg', 'info', 'active']
];

for (const [file] of expectedMappings) {
  if (!registry.includes(`'${file}'`)) fail(`Registry does not reference canonical asset: ${file}`);
  if (!documentation.includes('`' + file + '`')) fail(`Documentation does not reference canonical asset: ${file}`);
}

const monochromeFiles = [
  'box-fill.svg', 'box-outline.svg', 'list-fill.svg', 'list-outline.svg',
  'empty-circle.svg', 'check-fill.svg', 'check-outline.svg',
  'search.svg', 'clear-outline.svg', 'clear-fill.svg',
  'moon-fill.svg', 'moon-outline.svg', 'sun-fill.svg', 'sun-outline.svg',
  'sync-inprogress-outline.svg', 'sync-inprogress-fill.svg',
  'sync-warn-outline.svg', 'sync-warn-fill.svg', 'bulk-mode-outline.svg',
  'bulk-mode-fill.svg', 'bulk-pending-outline.svg', 'bulk-pending-fill.svg',
  'info-outline.svg', 'info-fill.svg'
];

for (const file of monochromeFiles) {
  const svg = readIcon(file);
  if (/fill=["']black["']/i.test(svg) || /stroke=["']black["']/i.test(svg)) {
    fail(`Canonical monochrome asset still contains hard-coded black: Icons/${file}`);
  }
}

const engine = read('pokedex-engine.js');
const stabilization = read('stabilization-v094.js');
if (/<svg\b/i.test(engine)) fail('pokedex-engine.js contains duplicated inline SVG artwork.');
if (/<svg\b/i.test(stabilization)) fail('stabilization-v094.js contains duplicated inline SVG artwork.');
if (!engine.includes("completion',state") || !engine.includes("'empty-circle.svg")) {
  fail('Completion UI is not routed through the shared icon system.');
}
if (!engine.includes("await ensureIconSystem()")) fail('Pokedex engine does not load the shared icon system before rendering.');
if (!stabilization.includes('Icon artwork is owned by icon-system.js/pokedex-engine.js')) {
  fail('Stabilization layer does not document shared icon ownership.');
}

console.log('Icon system regression checks passed.');
