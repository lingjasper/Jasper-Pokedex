(() => {
  'use strict';

  /* Beta v0.10 — data-driven Pokédex renderer.
   * Pokedexes/<game> is the source of truth. The renderer never invents,
   * merges, prunes, or repairs Pokémon/forms in the DOM. */

  const DEFAULT_GAME = 'White2';
  const RAW_ROOT = 'https://raw.githubusercontent.com/lingjasper/Jasper-Pokedex/main/Pokedexes/';
  const API_ROOT = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex/contents/Pokedexes?ref=main';
  const BOX_COLUMNS = 6;
  const BOX_ROWS = 5;
  const BOX_SIZE = BOX_COLUMNS * BOX_ROWS;
  const STATE_PREFIX = 'jasper_pokedex_state_';
  const LEGACY_WHITE2_STATE = 'b2w2_living_dex_saved_state';

  const stateKey = game => `${STATE_PREFIX}${game}`;
  const readState = game => {
    try {
      const current = JSON.parse(localStorage.getItem(stateKey(game)) || 'null');
      if (current && typeof current === 'object') return current;
      if (game === DEFAULT_GAME) {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_WHITE2_STATE) || 'null');
        if (legacy && typeof legacy === 'object') {
          localStorage.setItem(stateKey(game), JSON.stringify(legacy));
          return legacy;
        }
      }
    } catch {}
    return {};
  };
  const writeState = (game, state) => {
    localStorage.setItem(stateKey(game), JSON.stringify(state));
    if (game === DEFAULT_GAME) localStorage.setItem(LEGACY_WHITE2_STATE, JSON.stringify(state));
  };

  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  // Preserve the stable IDs used by the existing save data. The first entry
  // for a Dex number is the base ID (e.g. 016); repeated entries use the
  // source form label (e.g. 016-M, 104-Red, 159-Spring).
  const formKey = form => form
    .replace(/[()]/g, '')
    .replace(/\s+Form$/i, '')
    .replace(/\s+/g, '')
    .replace(/^NoDrive$/i, 'NoDrive');

  const parseSource = text => {
    const rows = [];
    const seenNumbers = new Set();
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\|\s*#?(\d+)\s*\|\s*(.*?)\s*\|\s*$/);
      if (!match) continue;
      const num = match[1].padStart(3, '0');
      const name = match[2].trim();
      if (!name || /^-+$/.test(name)) continue;

      const formMatch = name.match(/^(.*?)\s*(\([^)]*\))$/);
      const baseName = formMatch ? formMatch[1].trim() : name;
      const form = formMatch ? formMatch[2] : '';
      const key = form ? formKey(form) : '';
      const id = seenNumbers.has(num) && key ? `${num}-${key}` : num;

      rows.push({ id, num, name, baseName, form });
      seenNumbers.add(num);
    }
    return rows;
  };

  const sourceURL = game => `${RAW_ROOT}${encodeURIComponent(game)}`;

  const loadGame = async game => {
    const response = await fetch(sourceURL(game), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load Pokedexes/${game} (${response.status}).`);
    return parseSource(await response.text());
  };

  const discoverGames = async () => {
    try {
      const response = await fetch(API_ROOT, { cache: 'no-store' });
      if (!response.ok) throw new Error('Directory discovery failed');
      const entries = await response.json();
      return entries.filter(entry => entry.type === 'file').map(entry => entry.name).sort();
    } catch {
      return [DEFAULT_GAME];
    }
  };

  const displayName = game => game.replace(/([a-z])([A-Z])/g, '$1 $2') === 'White2'
    ? 'Pokémon White 2'
    : game.replace(/([a-z])([A-Z])/g, '$1 $2');

  const renderCell = (pokemon, state) => {
    const cell = document.createElement('div');
    cell.className = `cell${state[pokemon.id] === true ? ' completed' : ''}`;
    cell.dataset.id = pokemon.id;
    cell.dataset.num = pokemon.num;
    cell.dataset.name = pokemon.name;
    cell.innerHTML = `<span class="dex-num">${escapeHTML(pokemon.num)}</span><span class="name">${escapeHTML(pokemon.baseName)}${pokemon.form ? ` <span class="form">${escapeHTML(pokemon.form)}</span>` : ''}</span><div class="checkbox"></div>`;
    return cell;
  };

  const renderEmpty = () => {
    const cell = document.createElement('div');
    cell.className = 'cell empty';
    cell.setAttribute('aria-hidden', 'true');
    return cell;
  };

  const renderBoxes = (pokemon, state) => {
    const container = document.getElementById('boxContainer');
    if (!container) return;
    container.replaceChildren();
    const boxCount = Math.max(1, Math.ceil(pokemon.length / BOX_SIZE));

    for (let boxIndex = 0; boxIndex < boxCount; boxIndex++) {
      const items = pokemon.slice(boxIndex * BOX_SIZE, (boxIndex + 1) * BOX_SIZE);
      const box = document.createElement('div');
      box.className = 'pc-box';
      const title = document.createElement('div');
      title.className = 'box-title';
      title.textContent = `Box ${boxIndex + 1} — ${items.length ? `Dex #${items[0].num}–#${items[items.length - 1].num}` : 'Empty'}`;

      const wrapper = document.createElement('div');
      wrapper.className = 'grid-wrapper';
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.style.gridTemplateColumns = `repeat(${BOX_COLUMNS}, minmax(110px, 1fr))`;
      grid.style.gridTemplateRows = `repeat(${BOX_ROWS}, minmax(58px, auto))`;

      items.forEach(item => grid.appendChild(renderCell(item, state)));
      while (grid.children.length < BOX_SIZE) grid.appendChild(renderEmpty());

      wrapper.appendChild(grid);
      box.append(title, wrapper);
      container.appendChild(box);
    }
  };

  const renderList = (pokemon, state) => {
    const container = document.getElementById('listContainer');
    if (!container) return;
    container.replaceChildren();
    pokemon.forEach(item => {
      const row = document.createElement('div');
      row.className = `list-row${state[item.id] === true ? ' completed' : ''}`;
      row.dataset.id = item.id;
      row.dataset.num = item.num;
      row.dataset.name = item.name;
      row.innerHTML = `<div class="list-info"><span class="dex-num">${escapeHTML(item.num)}</span><span class="name">${escapeHTML(item.baseName)}${item.form ? ` <span class="form">${escapeHTML(item.form)}</span>` : ''}</span></div><div class="checkbox"></div>`;
      container.appendChild(row);
    });
  };

  const updateProgress = (pokemon, state) => {
    const text = document.querySelector('.dex-progress-text');
    if (!text) return;
    const registered = pokemon.filter(p => state[p.id] === true).length;
    text.textContent = `${registered} of ${pokemon.length} Pokémon registered · ${pokemon.length - registered} remaining · ${Math.round(registered / Math.max(1, pokemon.length) * 100)}% complete`;
  };

  const bindClicks = (game, pokemon) => {
    const toggle = event => {
      const target = event.target.closest('[data-id]');
      if (!target || target.classList.contains('empty')) return;
      const state = readState(game);
      state[target.dataset.id] = state[target.dataset.id] !== true;
      writeState(game, state);
      document.querySelectorAll(`[data-id="${CSS.escape(target.dataset.id)}"]`).forEach(el => el.classList.toggle('completed', state[target.dataset.id] === true));
      updateProgress(pokemon, state);
    };
    const box = document.getElementById('boxContainer');
    const list = document.getElementById('listContainer');
    if (box && !box.dataset.v010Bound) { box.dataset.v010Bound = '1'; box.addEventListener('click', toggle); }
    if (list && !list.dataset.v010Bound) { list.dataset.v010Bound = '1'; list.addEventListener('click', toggle); }
  };

  const updateTabs = games => {
    const tabs = document.querySelector('.tabs-container');
    if (!tabs) return;
    tabs.replaceChildren();
    games.forEach(game => {
      const button = document.createElement('button');
      button.className = 'tab-btn';
      button.dataset.game = game;
      button.textContent = displayName(game);
      tabs.appendChild(button);
    });
  };

  const setActiveTab = game => document.querySelectorAll('.tab-btn[data-game]').forEach(tab => tab.classList.toggle('active', tab.dataset.game === game));

  const renderGame = async game => {
    const pokemon = await loadGame(game);
    const state = readState(game);
    window.JASPER_ACTIVE_GAME = game;
    window.JASPER_POKEDEX = { game, pokemon, boxColumns: BOX_COLUMNS, boxRows: BOX_ROWS, boxSize: BOX_SIZE };
    setActiveTab(game);
    renderBoxes(pokemon, state);
    renderList(pokemon, state);
    bindClicks(game, pokemon);
    updateProgress(pokemon, state);
    document.title = `Jasper's Pokedex — ${displayName(game)}`;
  };

  const boot = async () => {
    const games = await discoverGames();
    if (!games.length) return;
    updateTabs(games);
    document.querySelector('.tabs-container')?.addEventListener('click', event => {
      const button = event.target.closest('.tab-btn[data-game]');
      if (button) renderGame(button.dataset.game).catch(console.error);
    });
    const requested = window.JASPER_DEFAULT_GAME && games.includes(window.JASPER_DEFAULT_GAME)
      ? window.JASPER_DEFAULT_GAME
      : games.includes(DEFAULT_GAME) ? DEFAULT_GAME : games[0];
    await renderGame(requested);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
