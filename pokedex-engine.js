(() => {
  'use strict';

  /*
   * Beta v0.10 — data-driven Pokédex renderer.
   *
   * The file in Pokedexes/<game> is the source of truth. The renderer does
   * not invent, merge, prune, or repair Pokémon/forms in the DOM.
   */

  const GAME_ROOT = 'Pokedexes';
  const DEFAULT_GAME = 'White2';
  const RAW_ROOT = 'https://raw.githubusercontent.com/lingjasper/Jasper-Pokedex/main/Pokedexes/';
  const API_ROOT = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex/contents/Pokedexes?ref=main';
  const BOX_COLUMNS = 6;
  const BOX_ROWS = 5;
  const BOX_SIZE = BOX_COLUMNS * BOX_ROWS;
  const STATE_PREFIX = 'jasper_pokedex_state_';

  const stateKey = game => `${STATE_PREFIX}${game}`;
  const readState = game => {
    try { return JSON.parse(localStorage.getItem(stateKey(game)) || '{}'); }
    catch { return {}; }
  };
  const writeState = (game, state) => localStorage.setItem(stateKey(game), JSON.stringify(state));

  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const parseSource = text => {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\|\s*#?(\d+)\s*\|\s*(.*?)\s*\|\s*$/);
      if (!match) continue;
      const num = match[1].padStart(3, '0');
      const name = match[2].trim();
      if (!name || /^-+$/.test(name)) continue;
      const formMatch = name.match(/^(.*?)\s*(\([^)]*\))$/);
      const baseName = formMatch ? formMatch[1].trim() : name;
      const form = formMatch ? formMatch[2] : '';
      const id = `${num}-${rows.length}`;
      rows.push({ id, num, name, baseName, form });
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

  const displayName = game => {
    const spaced = game.replace(/([a-z])([A-Z])/g, '$1 $2');
    return spaced === 'White2' ? 'Pokémon White 2' : spaced;
  };

  const renderCell = (pokemon, state) => {
    const completed = state[pokemon.id] === true;
    const cell = document.createElement('div');
    cell.className = `cell${completed ? ' completed' : ''}`;
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
      const start = boxIndex * BOX_SIZE;
      const items = pokemon.slice(start, start + BOX_SIZE);
      const box = document.createElement('div');
      box.className = 'pc-box';

      const title = document.createElement('div');
      title.className = 'box-title';
      const first = items[0]?.num;
      const last = items[items.length - 1]?.num;
      title.textContent = first === undefined
        ? `Box ${boxIndex + 1}`
        : `Box ${boxIndex + 1} — Dex #${first}–#${last}`;

      const wrapper = document.createElement('div');
      wrapper.className = 'grid-wrapper';
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.style.gridTemplateColumns = `repeat(${BOX_COLUMNS}, minmax(110px, 1fr))`;
      grid.style.gridTemplateRows = `repeat(${BOX_ROWS}, minmax(58px, auto))`;

      items.forEach(item => grid.appendChild(renderCell(item, state)));
      for (let i = items.length; i < BOX_SIZE; i++) grid.appendChild(renderEmpty());

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
    const requested = window.JASPER_DEFAULT_GAME && games.includes(window.JASPER_DEFAULT_GAME)
      ? window.JASPER_DEFAULT_GAME
      : games.includes(DEFAULT_GAME) ? DEFAULT_GAME : games[0];

    document.querySelector('.tabs-container')?.addEventListener('click', event => {
      const button = event.target.closest('.tab-btn[data-game]');
      if (button) renderGame(button.dataset.game).catch(console.error);
    });

    await renderGame(requested);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
