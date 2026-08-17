(() => {
  'use strict';

  /* Beta v0.11.0.1
   * Pokémon application owner. This is the single runtime owner for the
   * Pokémon dataset, progress state, Boxes, List, Search, counters and view.
   * It must not own GitHub authentication/sync or desktop/Bulk presentation. */

  const DEFAULT_GAME = 'White2';
  const RAW_ROOT = 'https://raw.githubusercontent.com/lingjasper/Jasper-Pokedex/main/Pokedexes/';
  const API_ROOT = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex/contents/Pokedexes?ref=main';
  const BOX_SIZE = 30, BOX_COLUMNS = 6, BOX_ROWS = 5;
  const STATE_PREFIX = 'jasper_pokedex_state_';
  const LEGACY_KEY = 'b2w2_living_dex_saved_state';

  let activeGame = DEFAULT_GAME;
  let activePokemon = [];
  let booted = false;

  const stateKey = game => `${STATE_PREFIX}${game}`;
  const readState = game => {
    try {
      const current = JSON.parse(localStorage.getItem(stateKey(game)) || 'null');
      if (current && typeof current === 'object') return current;
      if (game === DEFAULT_GAME) {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (legacy && typeof legacy === 'object') return legacy;
      }
    } catch (_) {}
    return {};
  };
  const writeState = (game, state) => {
    localStorage.setItem(stateKey(game), JSON.stringify(state));
    // Compatibility mirror only; application reads the game-scoped key above.
    if (game === DEFAULT_GAME) localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
  };
  const normalize = value => String(value).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const parseSource = text => {
    const result = [];
    const occurrences = new Map();
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\|\s*#?(\d+)\s*\|\s*(.*?)\s*\|\s*$/);
      if (!match) continue;
      const num = match[1].padStart(3, '0');
      const name = match[2].trim();
      if (!name || /^-+$/.test(name)) continue;

      const formMatch = name.match(/^(.*?)\s*(\([^)]*\))$/);
      const baseName = formMatch ? formMatch[1].trim() : name;
      const form = formMatch ? formMatch[2] : '';
      const occurrence = occurrences.get(num) || 0;
      occurrences.set(num, occurrence + 1);
      const id = occurrence ? `${num}-${occurrence}` : num;
      result.push({ id, num, name, baseName, form });
    }
    return result;
  };

  const loadGame = async game => {
    const response = await fetch(`${RAW_ROOT}${encodeURIComponent(game)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load Pokedexes/${game} (${response.status}).`);
    return parseSource(await response.text());
  };

  const discoverGames = async () => {
    try {
      const response = await fetch(API_ROOT, { cache: 'no-store' });
      if (!response.ok) throw new Error('directory unavailable');
      return (await response.json()).filter(e => e.type === 'file').map(e => e.name).sort();
    } catch (_) {
      return [DEFAULT_GAME];
    }
  };

  const release = () => window.JASPER_POKEDEX_VERSION || '';

  const setMoniker = () => {
    const value = release();
    document.querySelectorAll('#pokedexBetaMoniker, .desktop-sidebar-brand .beta').forEach(el => {
      el.textContent = value;
    });
    document.title = value ? `Jasper's Pokédex — ${value}` : "Jasper's Pokédex";
  };

  const ensureBanner = () => {
    let banner = document.getElementById('dexProgressBanner');
    if (!banner) {
      const workspace = document.getElementById('desktopWorkspace');
      const table = document.getElementById('desktopTableContainer');
      if (!workspace || !table) return null;
      banner = document.createElement('div');
      banner.id = 'dexProgressBanner';
      banner.innerHTML = '<span class="dex-progress-icon">i</span><span class="dex-progress-text"></span>';
      workspace.insertBefore(banner, table);
    }
    return banner;
  };

  const updateBanner = (pokemon = activePokemon, state = readState(activeGame)) => {
    const banner = ensureBanner();
    const text = banner?.querySelector('.dex-progress-text');
    if (!text) return;
    const registered = pokemon.reduce((count, p) => count + (state[p.id] === true ? 1 : 0), 0);
    const total = pokemon.length;
    const percent = Math.round((registered / Math.max(1, total)) * 100);
    text.textContent = `${registered} of ${total} Pokémon registered · ${total - registered} remaining · ${percent}% complete`;
  };

  const renderCell = (pokemon, state) => {
    const cell = document.createElement('div');
    cell.className = `cell${state[pokemon.id] === true ? ' completed' : ''}`;
    cell.dataset.id = pokemon.id;
    cell.dataset.num = pokemon.num;
    cell.dataset.name = pokemon.name;
    cell.innerHTML = `<span class="dex-num">${escapeHTML(pokemon.num)}</span><span class="name">${escapeHTML(pokemon.baseName)}${pokemon.form ? ` <span class="form">${escapeHTML(pokemon.form)}</span>` : ''}</span><div class="checkbox"></div>`;
    return cell;
  };

  const renderBoxes = (pokemon, state) => {
    const root = document.getElementById('boxContainer');
    if (!root) return;
    root.replaceChildren();

    const boxCount = Math.max(1, Math.ceil(pokemon.length / BOX_SIZE));
    for (let boxIndex = 0; boxIndex < boxCount; boxIndex++) {
      const items = pokemon.slice(boxIndex * BOX_SIZE, (boxIndex + 1) * BOX_SIZE);
      const box = document.createElement('section');
      box.className = 'pc-box';

      const title = document.createElement('div');
      title.className = 'box-title';
      title.innerHTML = `<span>Box ${boxIndex + 1} — ${items.length ? `Dex #${items[0].num}–#${items[items.length - 1].num}` : 'Empty'}</span><span class="box-completion-counter">${items.length}/${items.length}</span>`;

      const wrapper = document.createElement('div');
      wrapper.className = 'grid-wrapper';
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.style.gridTemplateColumns = `repeat(${BOX_COLUMNS}, minmax(110px, 1fr))`;
      grid.style.gridTemplateRows = `repeat(${BOX_ROWS}, minmax(58px, auto))`;

      items.forEach(p => grid.appendChild(renderCell(p, state)));
      while (grid.children.length < BOX_SIZE) {
        const empty = document.createElement('div');
        empty.className = 'cell empty';
        empty.setAttribute('aria-hidden', 'true');
        grid.appendChild(empty);
      }
      wrapper.appendChild(grid);
      box.append(title, wrapper);
      root.appendChild(box);
    }
  };

  const renderList = (pokemon, state) => {
    const root = document.getElementById('listContainer');
    if (!root) return;
    root.replaceChildren();
    pokemon.forEach(p => {
      const row = document.createElement('div');
      row.className = `list-row${state[p.id] === true ? ' completed' : ''}`;
      row.dataset.id = p.id;
      row.dataset.num = p.num;
      row.dataset.name = p.name;
      row.innerHTML = `<div class="checkbox"></div><div class="list-info"><span class="dex-num">#${escapeHTML(p.num)}</span><span class="name">${escapeHTML(p.baseName)}${p.form ? ` <span class="form">${escapeHTML(p.form)}</span>` : ''}</span></div>`;
      root.appendChild(row);
    });
  };

  const ensureClearButton = () => {
    const wrapper = document.querySelector('.search-wrapper');
    const input = document.getElementById('searchInput');
    if (!wrapper || !input) return null;
    let button = document.getElementById('searchClearButton');
    if (!button) {
      button = document.createElement('button');
      button.id = 'searchClearButton';
      button.type = 'button';
      button.setAttribute('aria-label', 'Clear search');
      button.textContent = '×';
      wrapper.appendChild(button);
    }
    const sync = () => { button.hidden = !input.value; };
    button.onclick = () => { input.value = ''; input.dispatchEvent(new Event('input', {bubbles:true})); input.focus(); sync(); };
    input.addEventListener('input', sync);
    sync();
    if (!document.getElementById('v011SearchStyles')) {
      const style = document.createElement('style');
      style.id = 'v011SearchStyles';
      style.textContent = `.search-wrapper{position:relative}.search-wrapper #searchInput{padding-right:42px}.search-wrapper #searchClearButton{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:50%;background:#e2e8f0;color:#475569;font-size:18px;line-height:20px;padding:0;cursor:pointer}.search-wrapper #searchClearButton[hidden]{display:none}@media(max-width:640px){.search-input{font-size:16px!important}.search-results{left:0;right:0;width:100%}.controls-container{margin-left:0;margin-right:0}.search-wrapper{min-width:0}}`;
      document.head.appendChild(style);
    }
    return button;
  };

  const renderSearch = (query = '') => {
    const input = document.getElementById('searchInput');
    const root = document.getElementById('searchResults');
    if (!input || !root) return;
    const q = normalize(query.trim());
    root.replaceChildren();
    if (!q) { root.style.display = 'none'; return; }

    const state = readState(activeGame);
    const matches = activePokemon
      .filter(p => normalize(p.name).includes(q) || p.num.includes(q))
      .sort((a,b) => a.name.localeCompare(b.name));

    if (!matches.length) {
      root.style.display = 'none';
      return;
    }

    matches.slice(0, 50).forEach(p => {
      const row = document.createElement('div');
      row.className = `search-result-item${state[p.id] === true ? ' completed' : ''}`;
      row.dataset.id = p.id;
      row.innerHTML = `<div class="checkbox"></div><span class="dex-num">#${escapeHTML(p.num)}</span><span class="name">${escapeHTML(p.baseName)}${p.form ? ` <span class="form">${escapeHTML(p.form)}</span>` : ''}</span><button class="search-jump" type="button">Jump</button>`;
      root.appendChild(row);
    });
    root.style.display = 'block';
  };

  const installSearch = () => {
    const input = document.getElementById('searchInput');
    const root = document.getElementById('searchResults');
    if (!input || !root) return;
    ensureClearButton();

    // Replace the legacy anonymous search listeners by replacing the input once.
    const freshInput = input.cloneNode(true);
    input.replaceWith(freshInput);
    const freshRoot = root;
    freshInput.id = 'searchInput';
    freshInput.placeholder = 'Search...';
    freshInput.autocomplete = 'off';
    freshInput.addEventListener('input', () => renderSearch(freshInput.value));
    freshInput.addEventListener('focus', () => { if (freshInput.value) renderSearch(freshInput.value); });
    freshRoot.onclick = event => {
      const result = event.target.closest('.search-result-item[data-id]');
      if (!result) return;
      const id = result.dataset.id;
      if (event.target.closest('.search-jump')) {
        const target = document.querySelector(`#boxContainer [data-id="${CSS.escape(id)}"]`) || document.querySelector(`#listContainer [data-id="${CSS.escape(id)}"]`);
        target?.scrollIntoView({behavior:'smooth', block:'center'});
        if (target) { target.classList.remove('jump-highlight'); void target.offsetWidth; target.classList.add('jump-highlight'); }
        freshRoot.style.display = 'none';
        return;
      }
      togglePokemon(id);
    };
    document.addEventListener('click', event => {
      if (!event.target.closest('.search-wrapper')) freshRoot.style.display = 'none';
    });
  };

  const installViewToggle = () => {
    const boxButton = document.getElementById('boxViewBtn');
    const listButton = document.getElementById('listViewBtn');
    const boxes = document.getElementById('boxContainer');
    const list = document.getElementById('listContainer');
    if (!boxButton || !listButton || !boxes || !list) return;
    const boxView = () => { boxes.style.display='flex'; list.style.display='none'; boxButton.classList.add('active'); listButton.classList.remove('active'); };
    const listView = () => { boxes.style.display='none'; list.style.display='block'; listButton.classList.add('active'); boxButton.classList.remove('active'); };
    boxButton.onclick = boxView;
    listButton.onclick = listView;
    boxView();
  };

  const updateCompletedVisuals = (id, completed) => {
    document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.toggle('completed', completed));
  };

  const togglePokemon = id => {
    const state = readState(activeGame);
    state[id] = state[id] !== true;
    writeState(activeGame, state);
    updateCompletedVisuals(id, state[id]);
    updateBanner(activePokemon, state);
    renderSearch(document.getElementById('searchInput')?.value || '');
  };

  const bindSelection = () => {
    const box = document.getElementById('boxContainer');
    const list = document.getElementById('listContainer');
    if (box) box.onclick = event => {
      const target = event.target.closest('.cell[data-id]');
      if (target && !target.classList.contains('empty')) togglePokemon(target.dataset.id);
    };
    if (list) list.onclick = event => {
      const target = event.target.closest('.list-row[data-id]');
      if (target) togglePokemon(target.dataset.id);
    };
  };

  const renderGame = async game => {
    const pokemon = await loadGame(game);
    activeGame = game;
    activePokemon = pokemon;
    window.JASPER_ACTIVE_GAME = game;
    window.JASPER_POKEDEX = { game, pokemon, boxSize:BOX_SIZE, boxColumns:BOX_COLUMNS, boxRows:BOX_ROWS };

    const state = readState(game);
    renderBoxes(pokemon, state);
    renderList(pokemon, state);
    installViewToggle();
    installSearch();
    bindSelection();
    updateBanner(pokemon, state);
    setMoniker();
  };

  const renderTabs = games => {
    const root = document.querySelector('.tabs-container');
    if (!root) return;
    root.replaceChildren();
    games.forEach(game => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab-btn';
      button.dataset.game = game;
      button.textContent = game === 'White2' ? 'Pokémon White 2' : game.replace(/([a-z])([A-Z])/g, '$1 $2');
      root.appendChild(button);
    });
    root.onclick = event => {
      const button = event.target.closest('.tab-btn[data-game]');
      if (!button) return;
      renderGame(button.dataset.game).catch(console.error);
    };
  };

  const boot = async () => {
    if (booted) return;
    booted = true;
    // version.js is loaded by the compatibility entry point; wait briefly rather than duplicating it.
    let tries = 0;
    while (!window.JASPER_POKEDEX_VERSION && tries++ < 100) await new Promise(r => setTimeout(r, 10));
    setMoniker();
    const games = await discoverGames();
    renderTabs(games);
    await renderGame(games.includes(DEFAULT_GAME) ? DEFAULT_GAME : games[0]);
  };

  // GitHub sync owns remote state; this renderer owns painting it.
  window.addEventListener('jasper:pokedex-state-synced', event => {
    const game = event.detail?.game || activeGame;
    renderGame(game).catch(console.error);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
