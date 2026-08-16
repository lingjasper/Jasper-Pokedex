(() => {
  'use strict';

  /* Beta v0.10.1.6
   * SINGLE OWNER: this renderer owns Pokémon data presentation and user state.
   * Pokedexes/<game> is the only Pokémon source of truth. */
  const RELEASE = window.JASPER_POKEDEX_VERSION;
  const DEFAULT_GAME = 'White2';
  const RAW_ROOT = 'https://raw.githubusercontent.com/lingjasper/Jasper-Pokedex/main/Pokedexes/';
  const API_ROOT = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex/contents/Pokedexes?ref=main';
  const BOX_SIZE = 30, BOX_COLUMNS = 6, BOX_ROWS = 5;
  const STATE_PREFIX = 'jasper_pokedex_state_';
  const LEGACY_KEY = 'b2w2_living_dex_saved_state';

  const key = game => `${STATE_PREFIX}${game}`;
  const readState = game => {
    try {
      const current = JSON.parse(localStorage.getItem(key(game)) || 'null');
      if (current && typeof current === 'object') return current;
      if (game === DEFAULT_GAME) {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (legacy && typeof legacy === 'object') return legacy;
      }
    } catch (_) {}
    return {};
  };
  const saveState = (game, state) => localStorage.setItem(key(game), JSON.stringify(state));
  const norm = s => String(s).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function parse(text) {
    const out = [], counts = new Map();
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\|\s*#?(\d+)\s*\|\s*(.*?)\s*\|\s*$/);
      if (!m || !m[2].trim() || /^-+$/.test(m[2].trim())) continue;
      const num = m[1].padStart(3, '0');
      const name = m[2].trim();
      const form = (name.match(/\(([^)]*)\)\)??$/) || [])[0] || '';
      const baseName = form ? name.slice(0, name.lastIndexOf(form)).trim() : name;
      const occurrence = counts.get(num) || 0;
      counts.set(num, occurrence + 1);
      out.push({ id: occurrence ? `${num}-${occurrence}` : num, num, name, baseName, form });
    }
    return out;
  }

  async function load(game) {
    const r = await fetch(`${RAW_ROOT}${encodeURIComponent(game)}`, {cache:'no-store'});
    if (!r.ok) throw new Error(`Could not load Pokedexes/${game}: ${r.status}`);
    return parse(await r.text());
  }
  async function games() {
    try {
      const r = await fetch(API_ROOT, {cache:'no-store'});
      if (!r.ok) throw new Error();
      return (await r.json()).filter(x => x.type === 'file').map(x => x.name).sort();
    } catch (_) { return [DEFAULT_GAME]; }
  }

  function moniker() {
    document.querySelectorAll('#pokedexBetaMoniker, .desktop-sidebar-brand .beta').forEach(x => x.textContent = RELEASE);
    document.title = `Jasper's Pokédex — ${RELEASE}`;
  }

  function cell(p, state) {
    const el = document.createElement('div');
    el.className = `cell${state[p.id] === true ? ' completed' : ''}`;
    el.dataset.id = p.id; el.dataset.num = p.num; el.dataset.name = p.name;
    el.innerHTML = `<span class="dex-num">${esc(p.num)}</span><span class="name">${esc(p.baseName)}${p.form ? ` <span class="form">${esc(p.form)}</span>` : ''}</span><div class="checkbox"></div>`;
    return el;
  }

  function renderBoxes(pokemon, state) {
    const root = document.getElementById('boxContainer'); if (!root) return;
    root.replaceChildren();
    const count = Math.max(1, Math.ceil(pokemon.length / BOX_SIZE));
    for (let b = 0; b < count; b++) {
      const items = pokemon.slice(b * BOX_SIZE, (b + 1) * BOX_SIZE);
      const box = document.createElement('section'); box.className = 'pc-box';
      const title = document.createElement('div'); title.className = 'box-title';
      title.style.position = 'relative';
      title.innerHTML = `<span>Box ${b + 1} — ${items.length ? `Dex #${items[0].num}–#${items[items.length - 1].num}` : 'Empty'}</span><span class="box-counter">${items.length}/${items.length}</span>`;
      const wrap = document.createElement('div'); wrap.className = 'grid-wrapper';
      const grid = document.createElement('div'); grid.className = 'grid';
      grid.style.gridTemplateColumns = `repeat(${BOX_COLUMNS}, minmax(110px, 1fr))`;
      grid.style.gridTemplateRows = `repeat(${BOX_ROWS}, minmax(58px, auto))`;
      items.forEach(p => grid.appendChild(cell(p, state)));
      while (grid.children.length < BOX_SIZE) { const e=document.createElement('div'); e.className='cell empty'; e.setAttribute('aria-hidden','true'); grid.appendChild(e); }
      wrap.appendChild(grid); box.append(title, wrap); root.appendChild(box);
    }
  }

  function renderList(pokemon, state) {
    const root = document.getElementById('listContainer'); if (!root) return;
    root.replaceChildren();
    pokemon.forEach(p => {
      const row=document.createElement('div'); row.className=`list-row${state[p.id]===true?' completed':''}`; row.dataset.id=p.id;
      row.innerHTML=`<div class="checkbox"></div><div class="list-info"><span class="dex-num">${esc(p.num)}</span><span class="name">${esc(p.baseName)}${p.form?` <span class="form">${esc(p.form)}</span>`:''}</span></div>`;
      root.appendChild(row);
    });
  }

  function renderBanner(pokemon, state) {
    const text=document.querySelector('.dex-progress-text'); if(!text)return;
    const done=pokemon.reduce((n,p)=>n+(state[p.id]===true?1:0),0);
    text.textContent=`${done} of ${pokemon.length} Pokémon registered · ${pokemon.length-done} remaining · ${Math.round(done/Math.max(1,pokemon.length)*100)}% complete`;
  }

  function search(pokemon, state) {
    const input=document.getElementById('searchInput'), root=document.getElementById('searchResults'); if(!input||!root)return;
    input.oninput=()=>{
      root.replaceChildren(); const q=norm(input.value.trim());
      if(!q){root.style.display='none';return;}
      pokemon.filter(p=>norm(p.name).includes(q)||p.num.includes(q)).slice(0,30).forEach(p=>{
        const row=document.createElement('div'); row.className=`search-result-item${state[p.id]===true?' completed':''}`; row.dataset.id=p.id;
        row.innerHTML=`<div class="checkbox"></div><div class="list-info"><span class="dex-num">${esc(p.num)}</span><span class="name">${esc(p.baseName)}${p.form?` <span class="form">${esc(p.form)}</span>`:''}</span></div>`;
        root.appendChild(row);
      });
      root.style.display='block';
    };
    root.onclick=e=>{
      const row=e.target.closest('.search-result-item[data-id]'); if(!row)return;
      const target=document.querySelector(`#boxContainer [data-id="${CSS.escape(row.dataset.id)}"]`) || document.querySelector(`#listContainer [data-id="${CSS.escape(row.dataset.id)}"]`);
      target?.scrollIntoView({behavior:'smooth',block:'center'}); root.style.display='none';
    };
  }

  function bindUserSelection(game, pokemon) {
    const toggle=e=>{
      const target=e.target.closest('#boxContainer .cell[data-id], #listContainer .list-row[data-id]');
      if(!target || target.classList.contains('empty')) return;
      const state=readState(game); state[target.dataset.id]=state[target.dataset.id]!==true; saveState(game,state);
      document.querySelectorAll(`[data-id="${CSS.escape(target.dataset.id)}"]`).forEach(x=>x.classList.toggle('completed',state[target.dataset.id]===true));
      renderBanner(pokemon,state);
    };
    const box=document.getElementById('boxContainer'), list=document.getElementById('listContainer');
    if(box){box.onclick=toggle;}
    if(list){list.onclick=toggle;}
  }

  function tabs(list) {
    const root=document.querySelector('.tabs-container'); if(!root)return;
    root.replaceChildren();
    list.forEach(game=>{const b=document.createElement('button');b.className='tab-btn';b.dataset.game=game;b.textContent=game==='White2'?'Pokemon White 2':game;root.appendChild(b);});
  }

  async function renderGame(game) {
    const pokemon=await load(game), state=readState(game);
    window.JASPER_ACTIVE_GAME=game;
    window.JASPER_POKEDEX={game,pokemon};
    renderBoxes(pokemon,state); renderList(pokemon,state); renderBanner(pokemon,state); search(pokemon,state); bindUserSelection(game,pokemon); moniker();
  }

  async function boot() {
    moniker();
    const list=await games(); tabs(list);
    const root=document.querySelector('.tabs-container');
    if(root) root.onclick=e=>{const b=e.target.closest('.tab-btn[data-game]'); if(b)renderGame(b.dataset.game).catch(console.error);};
    await renderGame(list.includes(DEFAULT_GAME)?DEFAULT_GAME:list[0]);
  }

  // Sync may update local state after this renderer has booted. Re-render immediately.
  window.addEventListener('jasper:pokedex-state-synced', async e => {
    const game=e.detail?.game || window.JASPER_ACTIVE_GAME || DEFAULT_GAME;
    try { await renderGame(game); } catch(err) { console.error(err); }
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
