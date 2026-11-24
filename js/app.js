/*
 * app.js — the application shell.
 *
 * One module owns the screen: it renders once from data, then patches only
 * the elements a change touches. There are no MutationObservers, polling
 * timers or patched browser APIs; every listener below is delegated from a
 * handful of containers that exist in index.html from the first paint.
 */
import {
  BOX_SIZE, changedIds, esc, migrateState, parseDex, placeholderArt, progress,
  safeStorage, searchEntries, spriteCandidates, toBoxes
} from './core.js';
import { createSync } from './sync.js';
import { createPokedex } from './pokedex.js';

const root = document.documentElement;

/*
 * Demo mode (<html data-demo>): no network beyond this folder and no game
 * artwork. Sprites and game icons become generated placeholders, sync is
 * switched off and Manage PC saves to this browser only. Used for previews.
 */
const DEMO = root.hasAttribute('data-demo');

const store = safeStorage((() => { try { return window.localStorage; } catch { return null; } })());
const KEYS = {
  theme: 'jasper-pokedex-theme',
  boot: 'jasper_pokedex_boot',
  view: 'jasper_pokedex_view',
  legacyState: 'b2w2_living_dex_saved_state',
  state: gameId => `jasper_pokedex_state_${gameId}`
};
const LEGACY_GAME = 'pokemon-white-2';
const FALLBACK_REGISTRY = {
  defaultGame: 'pokemon-white-2',
  games: [{ id: 'pokemon-white-2', name: 'Pokémon White 2', generation: 5, enabled: true, visible: true, icon: 'pokemon-white-2.png', dex: 'White2', save: 'saves/pokemon-white-2.json' }]
};
const TYPE_COLORS = {
  normal: '#8a8a59', fire: '#e2711d', water: '#4f7fe0', electric: '#f2c81e', grass: '#5fa83a', ice: '#7fcfcb',
  fighting: '#c22e28', poison: '#a33ea1', ground: '#d9b453', flying: '#8f7fe6', psychic: '#ee4c7c', bug: '#93a516',
  rock: '#a8932f', ghost: '#735797', dragon: '#6f35fc', dark: '#705746', steel: '#9d9db8', fairy: '#cf6fa3'
};
const DARK_INK_TYPES = new Set(['electric', 'ice', 'ground']);
const MULTIPLIER_LABELS = { 4: '4×', 2: '2×', 0.5: '½×', 0.25: '¼×', 0: '0×' };

const $ = id => document.getElementById(id);
const dom = {
  main: $('main'), gameList: $('gameList'), gameMenu: $('gameMenu'), gameSwitch: $('gameSwitch'),
  gameSwitchArt: $('gameSwitchArt'), gameSwitchName: $('gameSwitchName'), pageTitle: $('pageTitle'),
  manageBtn: $('manageBtn'), manageArt: $('manageArt'), themeBtn: $('themeBtn'), themeColor: $('themeColor'),
  sync: $('sync'), syncPill: $('syncPill'), syncMenu: $('syncMenu'), syncIcon: $('syncIcon'), syncLabel: $('syncLabel'),
  syncStatus: $('syncStatus'), syncLast: $('syncLast'), syncForm: $('syncForm'), token: $('githubTokenInput'),
  syncConnect: $('syncConnect'), syncChange: $('syncChange'), syncNote: $('syncNote'),
  search: $('searchInput'), searchClear: $('searchClear'), results: $('searchResults'),
  boxBtn: $('boxViewBtn'), listBtn: $('listViewBtn'),
  sumDone: $('sumDone'), sumTotal: $('sumTotal'), sumBar: $('sumBar'), sumRest: $('sumRest'),
  content: $('content'), boxes: $('boxContainer'), list: $('listContainer'), loadError: $('loadError'),
  inspector: $('inspector'), overview: $('overview'), detail: $('detail'), scrim: $('scrim'),
  bulkBar: $('bulkBar'), bulkText: $('bulkText'), bulkCancel: $('bulkCancel'), bulkSave: $('bulkSave'),
  toast: $('toast')
};

const app = {
  games: [],          // visible games, registry order
  game: null,         // active game config
  entries: [],
  byId: new Map(),    // entry id -> { entry, index }
  boxes: [],
  state: {},          // saved state of the active game
  draft: null,        // working copy while Manage PC is on
  view: store.get(KEYS.view) === 'list' ? 'list' : 'box',
  listReady: false,
  selected: null,     // entry id shown in the inspector
  loadToken: 0,
  syncState: 'none'
};

const phoneQuery = window.matchMedia('(max-width: 699.98px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const current = () => app.draft || app.state;
const isCaught = id => current()[id] === true;
const shortName = game => String(game?.name || '').replace(/^Pok[eé]mon\s+/i, '');
const idle = work => (window.requestIdleCallback ? window.requestIdleCallback(work, { timeout: 2000 }) : setTimeout(work, 600));

/** Cross-fade a DOM update where the browser supports view transitions. */
function swap(update) {
  if (!document.startViewTransition || reducedMotion.matches) { update(); return; }
  // A newer transition skips this one; the update itself still runs.
  const transition = document.startViewTransition(update);
  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
}

/* ---------- data ---------- */

async function fetchOk(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response;
}

const gameById = id => app.games.find(game => game.id === id) || null;
const dexPath = game => game.dex || game.dataset || game.id;
const savePath = game => game.save || `saves/${game.id}.json`;

const dexCache = new Map();
function loadDex(game) {
  const path = dexPath(game);
  if (!dexCache.has(path)) {
    const early = window.__jasperBoot;
    const fresh = () => fetchOk(`Pokedexes/${encodeURIComponent(path)}`).then(response => response.text());
    const text = early && early.dexPath === path ? early.dex.catch(fresh) : fresh();
    const entries = text.then(parseDex).then(list => {
      if (!list.length) throw new Error(`Pokedexes/${path} has no entries`);
      return list;
    });
    entries.catch(() => dexCache.delete(path));
    dexCache.set(path, entries);
  }
  return dexCache.get(path);
}

function readStored(game) {
  const own = store.json(KEYS.state(game.id));
  if (own && typeof own === 'object') return own;
  if (game.id === LEGACY_GAME) {
    const legacy = store.json(KEYS.legacyState);
    if (legacy && typeof legacy === 'object') return legacy;
  }
  return null;
}
const writeStored = (gameId, state) => store.set(KEYS.state(gameId), JSON.stringify(state));

/** The save file committed to the repo, served alongside the page. */
async function fetchSnapshot(game) {
  try {
    const response = await fetchOk(savePath(game), { cache: 'no-cache' });
    const payload = await response.json();
    return payload && typeof payload.pokemon === 'object' ? payload.pokemon : null;
  } catch { return null; }
}

/* ---------- sync + Pokédex services ---------- */

const sync = createSync({
  savePath: gameId => savePath(gameById(gameId) || { id: gameId }),
  entries: gameId => loadDex(gameById(gameId)),
  getState: gameId => (gameId === app.game?.id ? app.state : store.json(KEYS.state(gameId), {})),
  applyRemote(gameId, state) {
    writeStored(gameId, state);
    if (gameId === app.game?.id) adoptState(state);
  },
  onStatus: renderSync
}, { storage: store });

const pokedex = createPokedex({ storage: store });

/* ---------- artwork ---------- */

function spriteTag(entry, { eager = false } = {}) {
  const common = `class="sprite" width="68" height="56" alt="" decoding="async" draggable="false"`;
  if (DEMO) return `<img ${common} src="${placeholderArt(entry.id)}">`;
  const [first, ...rest] = spriteCandidates(entry.baseName, entry.form);
  return `<img ${common} src="Sprites/${encodeURIComponent(first)}.png" data-seed="${esc(entry.id)}"`
    + `${rest.length ? ` data-next="${esc(rest.join('|'))}"` : ''}${eager ? '' : ' loading="lazy"'}>`;
}

/** A missing sprite walks the candidate list, then falls back to placeholder art. */
function onImageError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.seed) return;
  const next = (img.dataset.next || '').split('|').filter(Boolean);
  if (next.length) {
    img.dataset.next = next.slice(1).join('|');
    img.src = `Sprites/${encodeURIComponent(next[0])}.png`;
  } else {
    const seed = img.dataset.seed;
    delete img.dataset.seed;
    img.src = placeholderArt(seed);
  }
}

function gameArt(game, attrs = '') {
  if (!DEMO && game.icon) return `<span class="game-art"${attrs}><img src="Game Icons/${encodeURIComponent(game.icon)}" width="32" height="32" alt=""></span>`;
  const mono = shortName(game).split(/[\s-]+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="game-art"${attrs} data-mono style="--hue:${((game.generation || 1) * 47 + 170) % 360}">${esc(mono)}</span>`;
}

/* ---------- rendering ---------- */

const entryLabel = entry =>
  `${entry.baseName}${entry.form ? `, ${entry.form}` : ''}, number ${entry.num}, ${isCaught(entry.id) ? 'registered' : 'not registered'}`;

function slotHTML(entry, eager) {
  return `<button type="button" class="slot${entry.form ? ' has-form' : ''}${isCaught(entry.id) ? ' is-caught' : ''}" data-id="${esc(entry.id)}" title="${esc(entry.name)}" aria-label="${esc(entryLabel(entry))}">`
    + spriteTag(entry, { eager })
    + `<span class="slot-name">${esc(entry.baseName)}</span>`
    + (entry.form ? `<span class="slot-form">${esc(entry.form)}</span>` : '')
    + `<span class="slot-num">${esc(entry.num)}</span></button>`;
}

const boxRange = box => (box.items.length ? `#${box.first}–#${box.last}` : 'Empty');
const boxCount = box => box.items.reduce((n, entry) => n + (isCaught(entry.id) ? 1 : 0), 0);

function renderBoxes() {
  const empty = '<span class="slot is-empty" aria-hidden="true"></span>';
  dom.boxes.innerHTML = app.boxes.map(box => {
    const done = boxCount(box);
    const n = box.index + 1;
    // The first two boxes are on screen at load on most devices: fetch their art right away.
    const slots = box.items.map(entry => slotHTML(entry, box.index < 2)).join('');
    return `<section class="box${done === box.items.length && done ? ' is-complete' : ''}" id="box-${n}" data-box="${box.index}" aria-labelledby="box-${n}-title">`
      + `<header class="box-head"><h2 class="box-title" id="box-${n}-title">Box ${n}</h2>`
      + `<span class="box-range">${boxRange(box)}</span>`
      + `<span class="box-count" data-count>${done}/${box.items.length}</span></header>`
      + `<div class="box-grid">${slots}${empty.repeat(Math.max(0, BOX_SIZE - box.items.length))}</div></section>`;
  }).join('');
  dom.boxes.removeAttribute('aria-busy');
}

function rowHTML(entry) {
  const state = isCaught(entry.id) ? ' is-caught' : '';
  return `<button type="button" class="row${state}" data-id="${esc(entry.id)}" aria-label="${esc(entryLabel(entry))}">`
    + `<span class="status"></span><span class="row-art">${spriteTag(entry)}</span>`
    + `<span class="num">#${esc(entry.num)}</span>`
    + `<span class="label">${esc(entry.baseName)}${entry.form ? ` <span class="form">${esc(entry.form)}</span>` : ''}</span></button>`;
}

function renderList() {
  dom.list.innerHTML = app.boxes.map(box => {
    const done = boxCount(box);
    const n = box.index + 1;
    return `<section class="list-group${done === box.items.length && done ? ' is-complete' : ''}" id="list-${n}" data-box="${box.index}" aria-labelledby="list-${n}-title">`
      + `<header class="list-head"><h2 class="list-title" id="list-${n}-title">Box ${n}</h2>`
      + `<span class="box-range">${boxRange(box)}</span>`
      + `<span class="box-count" data-count>${done}/${box.items.length}</span></header>`
      + `<div class="list-rows">${box.items.map(rowHTML).join('')}</div></section>`;
  }).join('');
  app.listReady = true;
  if (app.draft) changedIds(app.state, app.draft).forEach(paintEntry);
  if (app.selected) markSelected(app.selected, true);
}

function renderGames() {
  const html = app.games.map(game =>
    `<button type="button" class="game" data-game="${esc(game.id)}"${game.enabled ? '' : ' disabled'}>${gameArt(game)}<span class="game-name">${esc(game.name)}</span></button>`
  ).join('');
  dom.gameList.innerHTML = html;
  dom.gameMenu.innerHTML = html;
}

function markActiveGame(game) {
  document.querySelectorAll('.game[data-game]').forEach(button => {
    if (button.dataset.game === game.id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  dom.pageTitle.textContent = game.name;
  dom.gameSwitchName.textContent = shortName(game) || game.name;
  dom.gameSwitchArt.outerHTML = gameArt(game, ' id="gameSwitchArt" aria-hidden="true"');
  dom.gameSwitchArt = $('gameSwitchArt');
  document.title = `${game.name} · Jasper's Pokédex`;
}

/** Counts, meters and the overview column. Cheap enough to redo on every change. */
function refreshCounts() {
  const { done, total, remaining, percent } = progress(app.entries, current());
  dom.sumDone.textContent = done;
  dom.sumTotal.textContent = total;
  dom.sumRest.textContent = remaining ? `${remaining} to go` : 'Complete';
  dom.sumBar.style.setProperty('--p', total ? done / total : 0);

  const counts = app.boxes.map(boxCount);
  for (const view of [dom.boxes, dom.list]) {
    view.querySelectorAll('[data-box]').forEach(section => {
      const box = app.boxes[section.dataset.box];
      if (!box) return;
      const count = counts[box.index];
      section.querySelector('[data-count]').textContent = `${count}/${box.items.length}`;
      section.classList.toggle('is-complete', count > 0 && count === box.items.length);
    });
  }

  dom.overview.innerHTML = `<h2 class="overview-title">${esc(app.game?.name || '')}</h2>`
    + `<p class="overview-big"><strong>${done}</strong><span>of ${total}</span></p>`
    + `<div class="meter" aria-hidden="true"><span style="--p:${total ? done / total : 0}"></span></div>`
    + `<p class="overview-sub">${percent}% registered${remaining ? `, ${remaining} to go` : ''}</p>`
    + `<h3 class="overview-heading">Boxes</h3>`
    + app.boxes.map(box => {
      const count = counts[box.index];
      const size = box.items.length;
      return `<button type="button" class="overview-box" data-goto="${box.index}" aria-label="Go to box ${box.index + 1}, ${count} of ${size} registered">`
        + `<span>Box ${box.index + 1}</span><span class="meter"><i style="--p:${size ? count / size : 0}"></i></span><span>${count}/${size}</span></button>`;
    }).join('')
    + `<p class="overview-hint">Select a Pokémon to open its Pokédex entry here.</p>`;
}

/** Bring one entry's elements (box slot, list row, search result) in line with the state. */
function paintEntry(id) {
  const caught = isCaught(id);
  const pending = !!app.draft && caught !== (app.state[id] === true);
  const item = app.byId.get(id);
  document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(element => {
    element.classList.toggle('is-caught', caught);
    element.classList.toggle('is-pending', pending && caught);
    element.classList.toggle('is-removing', pending && !caught);
    if (item && element.hasAttribute('aria-label')) element.setAttribute('aria-label', entryLabel(item.entry));
  });
  if (id === app.selected) updateDetailStatus();
}

/** Replace the saved state (remote load, snapshot, commit) and repaint only what differs. */
function adoptState(next) {
  const before = current();
  app.state = next;
  changedIds(before, current()).forEach(paintEntry);
  if (app.draft) changedIds(app.state, app.draft).forEach(paintEntry);
  refreshCounts();
  updateBulkBar();
}

function setView(view, { keepPlace = true } = {}) {
  if (view === app.view) return;
  const anchor = keepPlace ? visibleBoxIndex() : 0;
  swap(() => {
    app.view = view;
    store.set(KEYS.view, view);
    if (view === 'list' && !app.listReady) renderList();
    dom.boxes.hidden = view !== 'box';
    dom.list.hidden = view !== 'list';
    dom.boxBtn.setAttribute('aria-pressed', String(view === 'box'));
    dom.listBtn.setAttribute('aria-pressed', String(view === 'list'));
    if (anchor > 0) gotoBox(anchor, 'auto');
  });
}

function visibleBoxIndex() {
  const view = app.view === 'list' ? dom.list : dom.boxes;
  const line = dom.main.querySelector('.topbar').getBoundingClientRect().bottom + 8;
  for (const section of view.querySelectorAll('[data-box]')) {
    if (section.getBoundingClientRect().bottom > line) return Number(section.dataset.box);
  }
  return 0;
}

function gotoBox(index, behavior) {
  const view = app.view === 'list' ? dom.list : dom.boxes;
  view.querySelector(`[data-box="${index}"]`)?.scrollIntoView({
    behavior: behavior || (reducedMotion.matches ? 'auto' : 'smooth'),
    block: 'start'
  });
}

/* ---------- opening a game ---------- */

async function openGame(gameId, { initial = false } = {}) {
  const game = gameById(gameId);
  if (!game || !game.enabled) return;
  if (!initial && game.id === app.game?.id) return;
  if (app.draft) {
    const dropped = changedIds(app.state, app.draft).length;
    leaveManage();
    if (dropped) toast(`Discarded ${dropped} unsaved ${dropped === 1 ? 'change' : 'changes'}`);
  }
  closeDetail();
  closePopovers();
  markActiveGame(game);

  const token = ++app.loadToken;
  dom.loadError.hidden = true;
  const stored = readStored(game);
  const useSnapshot = !stored && (DEMO || !sync.hasToken());
  let entries;
  let snapshot;
  try {
    [entries, snapshot] = await Promise.all([loadDex(game), useSnapshot ? fetchSnapshot(game) : null]);
  } catch (error) {
    if (token !== app.loadToken) return;
    console.error('[Jasper] Could not load the Pokédex.', error);
    dom.boxes.innerHTML = '';
    dom.list.innerHTML = '';
    dom.loadError.innerHTML = `<strong>${esc(game.name)} could not be loaded</strong>Check your connection and try again.<br><button type="button" data-retry="${esc(game.id)}">Try again</button>`;
    dom.loadError.hidden = false;
    return;
  }
  if (token !== app.loadToken) return;

  const state = migrateState(entries, stored || snapshot || {});
  // Older releases stored other key shapes; write the migrated copy back once.
  if (stored && JSON.stringify(stored) !== JSON.stringify(state)) writeStored(game.id, state);

  const paint = () => {
    app.game = game;
    app.entries = entries;
    app.byId = new Map(entries.map((entry, index) => [entry.id, { entry, index }]));
    app.boxes = toBoxes(entries);
    app.state = state;
    app.listReady = false;
    dom.list.innerHTML = '';
    renderBoxes();
    if (app.view === 'list') renderList();
    dom.boxes.hidden = app.view !== 'box';
    dom.list.hidden = app.view !== 'list';
    refreshCounts();
    clearSearch();
    if (!initial) window.scrollTo({ top: 0, behavior: 'auto' });
  };
  if (initial) paint(); else swap(paint);

  // Read by the inline scripts in index.html to start the next visit sooner.
  store.set(KEYS.boot, JSON.stringify({ game: game.id, dex: dexPath(game), name: game.name }));
  if (DEMO) renderSync({ state: 'demo' });
  else sync.load(game.id);
}

/* ---------- Manage PC ---------- */

const canManage = () => DEMO || (sync.hasToken() && app.syncState !== 'busy');

function updateManageButton() {
  const on = !!app.draft;
  dom.manageBtn.setAttribute('aria-pressed', String(on));
  dom.manageBtn.setAttribute('aria-disabled', String(!canManage()));
  dom.manageBtn.title = canManage() ? 'Catch or release Pokémon, then save once' : 'Activate a GitHub token to manage your PC';
}

function updateBulkBar() {
  const on = !!app.draft;
  dom.bulkBar.hidden = !on;
  document.body.classList.toggle('is-managing', on);
  if (!on) return;
  const n = changedIds(app.state, app.draft).length;
  dom.bulkText.textContent = n ? `${n} unsaved ${n === 1 ? 'change' : 'changes'}` : 'Catch or release your Pokémon.';
  dom.bulkSave.textContent = n ? `Save ${n} ${n === 1 ? 'change' : 'changes'}` : 'Save changes';
  dom.bulkSave.disabled = !n;
}

function enterManage() {
  if (app.draft) return;
  if (!canManage()) {
    toast(app.syncState === 'busy' ? 'Sync is in progress. Try again in a moment.' : 'Activate a GitHub token to manage your PC.');
    if (app.syncState !== 'busy') openPopover(dom.syncPill, dom.syncMenu);
    return;
  }
  closeDetail();
  app.draft = { ...app.state };
  updateManageButton();
  updateBulkBar();
}

/** Leave Manage PC and drop any unsaved changes. */
function leaveManage() {
  if (!app.draft) return;
  const touched = changedIds(app.state, app.draft);
  app.draft = null;
  touched.forEach(paintEntry);
  refreshCounts();
  updateManageButton();
  updateBulkBar();
}

function commitManage() {
  if (!app.draft) return;
  const touched = changedIds(app.state, app.draft);
  if (!touched.length) return;
  app.state = app.draft;
  app.draft = null;
  writeStored(app.game.id, app.state);
  touched.forEach(paintEntry);
  refreshCounts();
  updateManageButton();
  updateBulkBar();
  if (DEMO) toast(`Saved ${touched.length} ${touched.length === 1 ? 'change' : 'changes'} in this browser`);
  else sync.save(app.game.id);
}

function toggleDraft(id) {
  if (!app.draft || !app.byId.has(id)) return;
  app.draft[id] = !(app.draft[id] === true);
  paintEntry(id);
  refreshCounts();
  updateBulkBar();
}

/* ---------- Pokédex entry (inspector) ---------- */

function markSelected(id, on) {
  document.querySelectorAll(`.slot[data-id="${CSS.escape(id)}"], .row[data-id="${CSS.escape(id)}"]`)
    .forEach(element => element.classList.toggle('is-selected', on));
}

function updateDetailStatus() {
  const tag = dom.detail.querySelector('[data-status]');
  if (!tag || !app.selected) return;
  const caught = isCaught(app.selected);
  tag.classList.toggle('is-caught', caught);
  tag.textContent = caught ? 'Registered' : 'Not registered';
}

const typeTag = type =>
  `<span class="tag type"${DARK_INK_TYPES.has(type) ? ' data-ink="dark"' : ''} style="--type:${TYPE_COLORS[type] || '#64748b'}">${esc(type)}</span>`;

function whereHTML(detail) {
  if (!detail.hasLocationData) return '<p class="muted">Location data is not available for this game yet.</p>';
  if (!detail.locations.length) return '<p class="muted">Not found in the wild in this generation.</p>';
  const group = item => `<h4 class="where-game">${esc(item.game)}</h4>` + item.places.map(place =>
    `<div class="place"><p class="place-name">${esc(place.place)}</p>` + place.rows.map(row =>
      `<div class="place-row"><span>${esc(row.method)}${row.conditions ? `<small>${esc(row.conditions)}</small>` : ''}</span><span>${esc(row.chance)}</span><span>${esc(row.levels)}</span></div>`
    ).join('') + '</div>'
  ).join('');
  const own = app.game.id.replace(/^pokemon-/, '');
  const mine = detail.locations.filter(item => item.version === own);
  const others = detail.locations.filter(item => item.version !== own);
  if (!mine.length) return others.map(group).join('');
  return mine.map(group).join('')
    + (others.length ? `<details><summary>Also in ${esc(others.map(item => item.game).join(', '))}</summary>${others.map(group).join('')}</details>` : '');
}

function detailBodyHTML(entry, detail) {
  const evolution = detail.evolution.length
    ? `<ol class="evo">${detail.evolution.map(step => {
      const name = (slug, label) => `<span${slug === detail.species ? ' class="is-current"' : ''}>${esc(label)}</span>`;
      return `<li><span class="evo-names">${name(step.from, step.fromName)} → ${name(step.to, step.toName)}</span>`
        + `<span class="evo-how">${esc(step.how.join(' or ') || 'Special condition')}</span></li>`;
    }).join('')}</ol>`
    : `<p class="muted">${esc(entry.baseName)} does not evolve.</p>`;

  const matchups = detail.damage.length
    ? detail.damage.map(group =>
      `<div class="matchup"><span class="matchup-x">${MULTIPLIER_LABELS[group.multiplier] || `${group.multiplier}×`}</span>`
      + `<span class="matchup-types">${group.types.map(typeTag).join('')}</span></div>`).join('')
    : '<p class="muted">Takes normal damage from every type.</p>';

  const facts = [
    ['National Dex', detail.national != null ? `#${String(detail.national).padStart(3, '0')}` : '—'],
    ['Capture rate', detail.captureRate ?? '—'],
    ['Egg steps', detail.eggSteps != null ? detail.eggSteps.toLocaleString('en-US') : detail.eggCycles != null ? `${detail.eggCycles} cycles` : '—']
  ].map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`).join('');

  const held = detail.heldItems.length
    ? `<section class="section"><h3>Wild held items</h3><dl class="facts">${detail.heldItems.map(item =>
      `<div><dt>${esc(item.item)}</dt><dd>${item.rarity ? `${esc(item.rarity)}%` : '—'}</dd></div>`).join('')}</dl></section>`
    : '';

  return `<section class="section"><h3>Evolution</h3>${evolution}</section>`
    + `<section class="section"><h3>Where to find it</h3>${whereHTML(detail)}</section>`
    + `<section class="section"><h3>Damage taken${detail.generation ? ` in generation ${detail.generation}` : ''}</h3>${matchups}</section>`
    + `<section class="section"><h3>Catching and breeding</h3><dl class="facts">${facts}</dl></section>`
    + held;
}

const DETAIL_SKELETON = '<section class="section" aria-hidden="true"><div class="skeleton-line" style="width:38%"></div><div class="skeleton-line"></div><div class="skeleton-line" style="width:72%"></div></section>'.repeat(3);

async function openDetail(id) {
  const item = app.byId.get(id);
  if (!item) return;
  if (app.selected) markSelected(app.selected, false);
  app.selected = id;
  markSelected(id, true);

  const { entry, index } = item;
  const box = Math.floor(index / BOX_SIZE) + 1;
  const slot = (index % BOX_SIZE) + 1;
  const sprite = spriteTag(entry, { eager: true });
  dom.detail.innerHTML = `<div class="detail-grip" data-grip aria-hidden="true"></div>`
    + `<header class="detail-head" data-grip><div class="detail-stage">${sprite}</div>`
    + `<div><h2 class="detail-name">${esc(entry.baseName)}${entry.form ? `<span class="form">${esc(entry.form)}</span>` : ''}</h2>`
    + `<p class="detail-meta">#${esc(entry.num)} in ${esc(shortName(app.game))}, box ${box} slot ${slot}</p></div>`
    + `<button type="button" class="round-btn detail-close" data-close aria-label="Close Pokédex entry"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></header>`
    + `<div class="detail-tags"><span data-types></span><span class="tag" data-status></span></div>`
    + `<div class="detail-body" data-body aria-live="polite">${DETAIL_SKELETON}</div>`;
  updateDetailStatus();
  dom.detail.hidden = false;
  dom.inspector.classList.add('is-open');
  if (phoneQuery.matches) {
    dom.scrim.classList.add('is-on');
    dom.main.inert = true;
    dom.detail.focus({ preventScroll: true });
  }

  const body = dom.detail.querySelector('[data-body]');
  const types = dom.detail.querySelector('[data-types]');
  if (DEMO) {
    types.remove();
    body.innerHTML = '<section class="section"><h3>Pokédex data</h3><p>On the live site this panel loads evolution, wild locations, type matchups and catch data from PokéAPI.</p><p class="muted" style="margin-top:6px">This preview runs without network access, so only what the repository itself knows is shown above.</p></section>';
    return;
  }
  const game = app.game;
  try {
    const names = new Map(app.entries.map(e => [e.speciesId, e.baseName]));
    const detail = await pokedex.load(game.id, entry, names);
    if (app.selected !== id || app.game !== game) return;
    types.outerHTML = detail.types.map(typeTag).join('');
    body.innerHTML = detailBodyHTML(entry, detail);
  } catch (error) {
    if (app.selected !== id || app.game !== game) return;
    console.error('[Jasper] Pokédex entry failed to load.', error);
    body.innerHTML = `<section class="section"><h3>Pokédex data is unavailable</h3><p>${esc(error.message || 'PokéAPI could not be reached.')}</p>`
      + `<p class="muted">Your collection is not affected.</p><button type="button" class="retry" data-retry-detail="${esc(id)}">Try again</button></section>`;
  }
}

function closeDetail({ restoreFocus = false } = {}) {
  if (!app.selected) return;
  const id = app.selected;
  markSelected(id, false);
  app.selected = null;
  dom.inspector.classList.remove('is-open', 'is-dragging');
  dom.inspector.style.transform = '';
  dom.scrim.classList.remove('is-on');
  dom.main.inert = false;
  if (restoreFocus) {
    const view = app.view === 'list' ? dom.list : dom.boxes;
    view.querySelector(`[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }
}

/** Drag the sheet down by its handle or header to dismiss it (phones). */
function bindSheetDrag() {
  let startY = 0;
  let delta = 0;
  let dragging = false;
  dom.detail.addEventListener('pointerdown', event => {
    if (!phoneQuery.matches || !event.target.closest('[data-grip]') || event.target.closest('button')) return;
    dragging = true;
    startY = event.clientY;
    delta = 0;
    dom.inspector.classList.add('is-dragging');
    event.target.setPointerCapture?.(event.pointerId);
  });
  dom.detail.addEventListener('pointermove', event => {
    if (!dragging) return;
    delta = Math.max(0, event.clientY - startY);
    dom.inspector.style.transform = `translateY(${delta}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    dom.inspector.classList.remove('is-dragging');
    dom.inspector.style.transform = '';
    if (delta > 90) closeDetail({ restoreFocus: true });
  };
  dom.detail.addEventListener('pointerup', end);
  dom.detail.addEventListener('pointercancel', end);
}

/* ---------- entries: tap, search, jump ---------- */

function activateEntry(id) {
  if (app.draft) toggleDraft(id);
  else if (app.selected === id) closeDetail();
  else openDetail(id);
}

function renderResults() {
  const query = dom.search.value;
  dom.searchClear.hidden = !query;
  if (!query.trim()) { closeResults(); return; }
  const matches = searchEntries(app.entries, query);
  dom.results.innerHTML = matches.length
    ? matches.map(entry => {
      const caught = isCaught(entry.id);
      const pending = !!app.draft && caught !== (app.state[entry.id] === true);
      const state = `${caught ? ' is-caught' : ''}${pending ? (caught ? ' is-pending' : ' is-removing') : ''}`;
      return `<div class="result" role="option"><button type="button" class="result-main${state}" data-id="${esc(entry.id)}">`
        + `<span class="status"></span><span class="num">#${esc(entry.num)}</span>`
        + `<span class="label">${esc(entry.baseName)}${entry.form ? ` <span class="form">${esc(entry.form)}</span>` : ''}</span></button>`
        + `<button type="button" class="result-jump" data-jump="${esc(entry.id)}" aria-label="Jump to ${esc(entry.name)}">Jump</button></div>`;
    }).join('')
    : `<p class="result-empty">No Pokémon in this Pokédex matches “${esc(query.trim())}”.</p>`;
  dom.results.hidden = false;
  dom.search.setAttribute('aria-expanded', 'true');
}

function closeResults() {
  dom.results.hidden = true;
  dom.search.setAttribute('aria-expanded', 'false');
}

function clearSearch() {
  dom.search.value = '';
  dom.searchClear.hidden = true;
  closeResults();
}

function jumpTo(id) {
  closeResults();
  dom.search.blur();
  if (app.view === 'list' && !app.listReady) renderList();
  const view = app.view === 'list' ? dom.list : dom.boxes;
  const target = view.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
  target.classList.remove('is-jumped');
  requestAnimationFrame(() => target.classList.add('is-jumped'));
  target.addEventListener('animationend', () => target.classList.remove('is-jumped'), { once: true });
  target.focus({ preventScroll: true });
}

/* ---------- popovers, theme, toast, sync status ---------- */

const POPOVERS = [[() => dom.gameSwitch, () => dom.gameMenu], [() => dom.syncPill, () => dom.syncMenu]];

function openPopover(trigger, panel) {
  closePopovers();
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
}

function closePopovers() {
  for (const [trigger, panel] of POPOVERS) {
    panel().hidden = true;
    trigger().setAttribute('aria-expanded', 'false');
  }
}

function togglePopover(trigger, panel) {
  if (panel.hidden) openPopover(trigger, panel);
  else closePopovers();
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  dom.themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  dom.themeColor?.setAttribute('content', dark ? '#111318' : '#f1f5f9');
}

let toastTimer = 0;
function toast(message) {
  clearTimeout(toastTimer);
  dom.toast.hidden = true;
  // Re-showing on the next frame restarts the entrance animation.
  requestAnimationFrame(() => {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 2600);
  });
}

const SYNC_ICONS = { none: '#i-sync-token-needed', ok: '#i-check', busy: '#i-sync-inprogress', error: '#i-sync-warn', demo: '#i-check' };

function renderSync({ state, label, message, lastSynced }) {
  app.syncState = state;
  dom.sync.dataset.state = state;
  dom.syncIcon.setAttribute('href', SYNC_ICONS[state] || SYNC_ICONS.none);
  if (state === 'demo') {
    dom.syncLabel.textContent = 'Preview';
    dom.syncStatus.textContent = 'Sync is off in this preview';
    dom.syncLast.textContent = '';
    dom.syncForm.hidden = true;
    dom.syncNote.textContent = 'On the live site, Manage PC saves your changes to saves/<game>.json in the GitHub repository. Here they stay in this browser, and artwork is replaced by placeholders.';
    updateManageButton();
    return;
  }
  dom.syncLabel.textContent = label;
  dom.syncPill.setAttribute('aria-label', `Sync: ${label}`);
  dom.syncStatus.textContent = message || label;
  const when = lastSynced ? new Date(lastSynced) : null;
  dom.syncLast.textContent = when && !Number.isNaN(when.getTime())
    ? `Last saved ${when.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : '';
  const active = sync.hasToken();
  dom.token.disabled = active;
  dom.token.type = active ? 'text' : 'password';
  dom.token.value = active ? '••••••••••••••••' : (state === 'error' ? dom.token.value : '');
  dom.syncConnect.hidden = active;
  dom.syncChange.hidden = !active;
  updateManageButton();
  // The pill is icon-only on phones, so say what went wrong.
  if (state === 'error' && message) toast(message);
}

/* ---------- wiring ---------- */

function bind() {
  // Sprites: one capturing listener handles every missing image.
  document.addEventListener('error', onImageError, true);

  // Collection: slots and rows.
  dom.content.addEventListener('click', event => {
    const retry = event.target.closest('[data-retry]');
    if (retry) { openGame(retry.dataset.retry, { initial: true }); return; }
    const entry = event.target.closest('.slot[data-id], .row[data-id]');
    if (entry) activateEntry(entry.dataset.id);
  });

  // Games: sidebar and compact menu share one handler.
  for (const container of [dom.gameList, dom.gameMenu]) {
    container.addEventListener('click', event => {
      const button = event.target.closest('.game[data-game]');
      if (button && !button.disabled) openGame(button.dataset.game);
    });
  }
  dom.gameSwitch.addEventListener('click', () => togglePopover(dom.gameSwitch, dom.gameMenu));
  dom.syncPill.addEventListener('click', () => togglePopover(dom.syncPill, dom.syncMenu));

  // Search.
  dom.search.addEventListener('input', renderResults);
  dom.search.addEventListener('focus', () => { if (dom.search.value.trim()) renderResults(); });
  dom.search.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const first = dom.results.querySelector('[data-jump]');
      if (first && !dom.results.hidden) { event.preventDefault(); jumpTo(first.dataset.jump); }
    } else if (event.key === 'ArrowDown' && !dom.results.hidden) {
      event.preventDefault();
      dom.results.querySelector('.result-main')?.focus();
    }
  });
  dom.searchClear.addEventListener('click', () => { clearSearch(); dom.search.focus(); });
  dom.results.addEventListener('click', event => {
    const jump = event.target.closest('[data-jump]');
    if (jump) { jumpTo(jump.dataset.jump); return; }
    const main = event.target.closest('.result-main[data-id]');
    if (!main) return;
    if (app.draft) { toggleDraft(main.dataset.id); renderResults(); return; }
    closeResults();
    dom.search.blur();
    openDetail(main.dataset.id);
  });
  dom.results.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...dom.results.querySelectorAll('.result-main')];
    const at = items.indexOf(document.activeElement);
    if (at < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && at === 0) dom.search.focus();
    else items[Math.min(items.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1))]?.focus();
  });

  // View, theme, Manage PC.
  dom.boxBtn.addEventListener('click', () => setView('box'));
  dom.listBtn.addEventListener('click', () => setView('list'));
  dom.themeBtn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set(KEYS.theme, next);
    swap(() => applyTheme(next));
  });
  dom.manageBtn.addEventListener('click', () => {
    closePopovers();
    if (app.draft) leaveManage(); else enterManage();
  });
  dom.bulkCancel.addEventListener('click', leaveManage);
  dom.bulkSave.addEventListener('click', commitManage);

  // Sync menu.
  dom.syncForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!app.game || sync.hasToken()) return;
    await sync.connect(dom.token.value, app.game.id);
  });
  dom.syncChange.addEventListener('click', () => {
    if (app.draft) leaveManage();
    sync.disconnect(app.games.map(game => game.id));
    dom.token.focus();
  });

  // Inspector.
  dom.inspector.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) { closeDetail({ restoreFocus: true }); return; }
    const retry = event.target.closest('[data-retry-detail]');
    if (retry) { openDetail(retry.dataset.retryDetail); return; }
    const goto = event.target.closest('[data-goto]');
    if (goto) gotoBox(Number(goto.dataset.goto));
  });
  dom.scrim.addEventListener('click', () => closeDetail({ restoreFocus: true }));
  bindSheetDrag();
  // Leaving the phone layout while the sheet is open: drop the modal behaviour.
  phoneQuery.addEventListener('change', event => {
    if (!event.matches) { dom.scrim.classList.remove('is-on'); dom.main.inert = false; }
    else if (app.selected) { dom.scrim.classList.add('is-on'); dom.main.inert = true; }
  });

  // Dismissal: outside clicks and Escape.
  document.addEventListener('click', event => {
    if (!event.target.closest('#gameSwitch, #gameMenu, #sync, #manageBtn')) closePopovers();
    if (!event.target.closest('.tools')) closeResults();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!dom.results.hidden) { closeResults(); return; }
    if (!dom.gameMenu.hidden || !dom.syncMenu.hidden) { closePopovers(); return; }
    if (app.selected) closeDetail({ restoreFocus: true });
  });
}

async function boot() {
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  dom.boxBtn.setAttribute('aria-pressed', String(app.view === 'box'));
  dom.listBtn.setAttribute('aria-pressed', String(app.view === 'list'));
  if (DEMO) dom.manageArt.innerHTML = '<svg class="icon"><use href="#i-tray"/></svg>';
  bind();
  updateManageButton();

  const early = window.__jasperBoot;
  const registry = await (early?.registry || Promise.reject())
    .catch(() => fetchOk('data/games.json').then(response => response.json()))
    .catch(() => FALLBACK_REGISTRY);
  const games = Array.isArray(registry.games) ? registry.games.filter(game => game && game.id && game.visible !== false) : [];
  app.games = games.length ? games : FALLBACK_REGISTRY.games;
  renderGames();

  const last = store.json(KEYS.boot)?.game;
  const start = [last, registry.defaultGame].map(gameById).find(game => game?.enabled)
    || app.games.find(game => game.enabled);
  if (!start) {
    dom.boxes.innerHTML = '';
    dom.loadError.innerHTML = '<strong>No Pokédex is enabled</strong>Enable a game in data/games.json.';
    dom.loadError.hidden = false;
    return;
  }
  await openGame(start.id, { initial: true });
  idle(() => pokedex.retireOldCaches());
}

boot();
