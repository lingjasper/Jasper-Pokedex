(() => {
  'use strict';

  const RELEASE = 'Beta v0.10.4';
  const DEFAULT_GAME = 'White2';
  const RAW_ROOT = 'https://raw.githubusercontent.com/lingjasper/Jasper-Pokedex/main/Pokedexes/';
  const API_ROOT = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex/contents/Pokedexes?ref=main';
  const BOX_COLUMNS = 6, BOX_ROWS = 5, BOX_SIZE = BOX_COLUMNS * BOX_ROWS;
  const STATE_PREFIX = 'jasper_pokedex_state_', LEGACY_WHITE2_STATE = 'b2w2_living_dex_saved_state';
  const stateKey = game => `${STATE_PREFIX}${game}`;
  const readState = game => { try { const a=JSON.parse(localStorage.getItem(stateKey(game))||'null'); if(a&&typeof a==='object')return a; if(game===DEFAULT_GAME){const b=JSON.parse(localStorage.getItem(LEGACY_WHITE2_STATE)||'null');if(b&&typeof b==='object'){localStorage.setItem(stateKey(game),JSON.stringify(b));return b;}} } catch {} return {}; };
  const writeState = (game,state) => { localStorage.setItem(stateKey(game),JSON.stringify(state)); if(game===DEFAULT_GAME)localStorage.setItem(LEGACY_WHITE2_STATE,JSON.stringify(state)); };
  const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const formKey = f => f.replace(/[()]/g,'').replace(/\s+Form$/i,'').replace(/\s+/g,'');

  const parseSource = text => { const rows=[],seen=new Set(); for(const line of text.split(/\r?\n/)){const m=line.match(/^\|\s*#?(\d+)\s*\|\s*(.*?)\s*\|\s*$/);if(!m)continue;const num=m[1].padStart(3,'0'),name=m[2].trim();if(!name||/^-+$/.test(name))continue;const fm=name.match(/^(.*?)\s*(\([^)]*\))$/),baseName=fm?fm[1].trim():name,form=fm?fm[2]:'';const id=seen.has(num)&&form?`${num}-${formKey(form)}`:num;rows.push({id,num,name,baseName,form});seen.add(num);} return rows; };
  const loadGame = async game => { const r=await fetch(`${RAW_ROOT}${encodeURIComponent(game)}`,{cache:'no-store'}); if(!r.ok)throw new Error(`Could not load Pokedexes/${game} (${r.status}).`); return parseSource(await r.text()); };
  const discoverGames = async()=>{try{const r=await fetch(API_ROOT,{cache:'no-store'});if(!r.ok)throw 0;const e=await r.json();return e.filter(x=>x.type==='file').map(x=>x.name).sort();}catch{return[DEFAULT_GAME];}};
  const displayName = game => {const s=game.replace(/([a-z])([A-Z])/g,'$1 $2');return s==='White2'?'Pokémon White 2':s;};

  const installReleaseMoniker = () => { document.querySelectorAll('#pokedexBetaMoniker,.desktop-sidebar-brand .beta').forEach(e=>e.textContent=RELEASE); const title=document.querySelector('#desktopWorkspaceTitle'); if(title)title.dataset.release=RELEASE; document.title=`Jasper's Pokédex — ${RELEASE}`; };

  const ensureSupportUI = () => {
    // Recreate the shared banner/pill if an older HTML shell or legacy script removed them.
    let banner=document.getElementById('dexProgressBanner');
    if(!banner){
      banner=document.createElement('div'); banner.id='dexProgressBanner';
      banner.innerHTML='<span class="dex-progress-icon">✓</span><span class="dex-progress-text">0 of 0 Pokémon registered · 0 remaining · 0% complete</span>';
      const main=document.querySelector('.main-content');
      if(main) main.parentElement.insertBefore(banner,main);
    }
    let wrap=document.getElementById('githubSyncWrap');
    if(!wrap){
      wrap=document.createElement('div'); wrap.id='githubSyncWrap'; wrap.innerHTML=`
        <button id="githubSyncPill" type="button" aria-label="GitHub token sync"><span id="githubSyncIcon" class="github-sync-icon">×</span><span class="github-sync-label">Token Sync</span><span class="github-sync-chevron"></span></button>
        <div id="githubSyncMenu">
          <div id="githubSyncStatus">Token Sync</div>
          <div id="githubLastSynced"></div>
          <div id="githubSyncControls"><input id="githubTokenInput" type="password" autocomplete="off" placeholder="GitHub token"><button id="githubConnectBtn" type="button">Connect</button><button id="githubChangeTokenBtn" type="button" hidden>Change</button></div>
        </div>`;
      const top=document.querySelector('#pokedexHeaderTop')||document.querySelector('.controls-container')?.parentElement;
      if(top) top.appendChild(wrap); else document.body.prepend(wrap);
    }
    const pill=document.getElementById('githubSyncPill');
    if(pill && !pill.dataset.v0104Bound){
      pill.dataset.v0104Bound='1';
      pill.addEventListener('click',e=>{e.stopPropagation();wrap.classList.toggle('open');});
      document.addEventListener('click',e=>{if(!wrap.contains(e.target))wrap.classList.remove('open');});
    }
  };

  const installLayoutFixes = () => { if(document.getElementById('v0104LayoutStyles'))return;const s=document.createElement('style');s.id='v0104LayoutStyles';s.textContent=`
    #boxContainer .grid .cell{justify-content:center!important;align-items:center!important;text-align:center!important}#boxContainer .grid .cell .dex-num,#boxContainer .grid .cell .name,#boxContainer .grid .cell .checkbox{margin-left:auto!important;margin-right:auto!important}
    #listContainer .list-row{justify-content:flex-start!important}#listContainer .list-row>.checkbox{order:-1!important;margin:0!important}#listContainer .list-row>.list-info{flex:1 1 auto}
    #searchResults .search-result-item{display:flex;align-items:center;justify-content:flex-start}
    .search-wrapper{position:relative!important}.search-input{padding-right:44px!important}
    #searchClearButton{position:absolute!important;top:50%!important;right:10px!important;transform:translateY(-50%)!important;width:24px!important;height:24px!important;margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;display:none;align-items:center!important;justify-content:center!important;line-height:24px!important;font-size:16px!important;z-index:20!important}
    #dexProgressBanner{display:flex!important;align-items:center!important}
    #githubSyncWrap{display:block!important}
    @media(max-width:640px){
      .search-input{font-size:16px!important}.search-input::placeholder{font-size:16px!important}.search-wrapper{position:relative!important}
      #searchResults{position:fixed!important;left:8px!important;right:8px!important;width:auto!important;max-width:none!important;margin-top:4px!important;box-sizing:border-box!important}
      #searchResults .search-result-item{padding-left:12px!important;padding-right:12px!important}
      #searchClearButton{right:10px!important}
      #dexProgressBanner{margin-left:8px!important;margin-right:8px!important}
      #githubSyncWrap{max-width:calc(100vw - 16px)!important}
    }
  `;document.head.appendChild(s); };

  const renderCell=(p,state)=>{const c=document.createElement('div');c.className=`cell${state[p.id]===true?' completed':''}`;c.dataset.id=p.id;c.dataset.num=p.num;c.dataset.name=p.name;c.innerHTML=`<span class="dex-num">${esc(p.num)}</span><span class="name">${esc(p.baseName)}${p.form?` <span class="form">${esc(p.form)}</span>`:''}</span><div class="checkbox"></div>`;return c;};
  const empty=()=>{const c=document.createElement('div');c.className='cell empty';c.setAttribute('aria-hidden','true');return c;};
  const renderBoxes=(pokemon,state)=>{const c=document.getElementById('boxContainer');if(!c)return;c.replaceChildren();for(let b=0;b<Math.max(1,Math.ceil(pokemon.length/BOX_SIZE));b++){const items=pokemon.slice(b*BOX_SIZE,(b+1)*BOX_SIZE),box=document.createElement('div');box.className='pc-box';const t=document.createElement('div');t.className='box-title';t.textContent=`Box ${b+1} — ${items.length?`Dex #${items[0].num}–#${items[items.length-1].num}`:'Empty'}`;const w=document.createElement('div');w.className='grid-wrapper';const g=document.createElement('div');g.className='grid';g.style.gridTemplateColumns=`repeat(${BOX_COLUMNS},minmax(110px,1fr))`;g.style.gridTemplateRows=`repeat(${BOX_ROWS},minmax(58px,auto))`;items.forEach(p=>g.appendChild(renderCell(p,state)));while(g.children.length<BOX_SIZE)g.appendChild(empty());w.appendChild(g);box.append(t,w);c.appendChild(box);}};
  const renderList=(pokemon,state)=>{const c=document.getElementById('listContainer');if(!c)return;c.replaceChildren();pokemon.forEach(p=>{const r=document.createElement('div');r.className=`list-row${state[p.id]===true?' completed':''}`;r.dataset.id=p.id;r.dataset.num=p.num;r.dataset.name=p.name;r.innerHTML=`<div class="checkbox"></div><div class="list-info"><span class="dex-num">${esc(p.num)}</span><span class="name">${esc(p.baseName)}${p.form?` <span class="form">${esc(p.form)}</span>`:''}</span></div>`;c.appendChild(r);});};
  const updateProgress=(pokemon,state)=>{const t=document.querySelector('.dex-progress-text');if(t){const n=pokemon.filter(p=>state[p.id]===true).length;t.textContent=`${n} of ${pokemon.length} Pokémon registered · ${pokemon.length-n} remaining · ${Math.round(n/Math.max(1,pokemon.length)*100)}% complete`;}};

  const renderSearchResults=(q,pokemon,state)=>{const r=document.getElementById('searchResults');if(!r)return;const query=norm(q.trim());r.replaceChildren();if(!query){r.style.display='none';return;}const matches=pokemon.filter(p=>norm(p.name).includes(query)||norm(p.baseName).includes(query)||p.num.includes(query)).slice(0,50);matches.forEach(p=>{const x=document.createElement('div');x.className='search-result-item';x.dataset.id=p.id;x.innerHTML=`<span class="dex-num">${esc(p.num)}</span><span class="name">${esc(p.baseName)}${p.form?` <span class="form">${esc(p.form)}</span>`:''}</span>`;x.addEventListener('click',()=>{const listVisible=getComputedStyle(document.getElementById('listContainer')||{}).display==='block';const target=(listVisible?document.querySelector(`#listContainer [data-id="${CSS.escape(p.id)}"]`):null)||document.querySelector(`#boxContainer [data-id="${CSS.escape(p.id)}"]`);target?.scrollIntoView({behavior:'smooth',block:'center'});r.style.display='none';});r.appendChild(x);});r.style.display=matches.length?'block':'none';};

  const installSearch=(pokemon,game)=>{const input=document.getElementById('searchInput'),r=document.getElementById('searchResults'),w=document.querySelector('.search-wrapper');if(!input||!r||!w)return;input.placeholder='Search by pokemon name or by regional dex number...';input.oninput=()=>renderSearchResults(input.value,pokemon,readState(game));input.onfocus=()=>{if(input.value.trim())renderSearchResults(input.value,pokemon,readState(game));};let clear=document.getElementById('searchClearButton');if(!clear){clear=document.createElement('button');clear.type='button';clear.id='searchClearButton';clear.setAttribute('aria-label','Clear search');clear.title='Clear search';clear.textContent='×';w.appendChild(clear);}const sync=()=>{clear.style.display=input.value.trim()?'flex':'none';};clear.onclick=()=>{input.value='';sync();r.style.display='none';input.focus();};input.oninput=()=>{sync();renderSearchResults(input.value,pokemon,readState(game));};input.onkeydown=e=>{if(e.key==='Escape'){input.value='';sync();r.style.display='none';}};sync();};

  const removeSeparateJump=()=>{document.querySelectorAll('.v0102-jump').forEach(e=>e.remove());};
  const bindClicks=(game,pokemon)=>{const toggle=e=>{const t=e.target.closest('[data-id]');if(!t||t.classList.contains('empty'))return;const s=readState(game);s[t.dataset.id]=s[t.dataset.id]!==true;writeState(game,s);document.querySelectorAll(`[data-id="${CSS.escape(t.dataset.id)}"]`).forEach(x=>x.classList.toggle('completed',s[t.dataset.id]===true));updateProgress(pokemon,s);};const b=document.getElementById('boxContainer'),l=document.getElementById('listContainer');if(b&&!b.dataset.v0104Bound){b.dataset.v0104Bound='1';b.addEventListener('click',toggle);}if(l&&!l.dataset.v0104Bound){l.dataset.v0104Bound='1';l.addEventListener('click',toggle);}};
  const updateTabs=games=>{const t=document.querySelector('.tabs-container');if(!t)return;t.replaceChildren();games.forEach(g=>{const b=document.createElement('button');b.className='tab-btn';b.dataset.game=g;b.textContent=displayName(g);t.appendChild(b);});};
  const renderGame=async game=>{const p=await loadGame(game),s=readState(game);window.JASPER_ACTIVE_GAME=game;window.JASPER_POKEDEX={game,pokemon:p,boxColumns:BOX_COLUMNS,boxRows:BOX_ROWS,boxSize:BOX_SIZE};setActiveTab(game);renderBoxes(p,s);renderList(p,s);bindClicks(game,p);installSearch(p,game);removeSeparateJump();updateProgress(p,s);ensureSupportUI();installReleaseMoniker();};
  const setActiveTab=game=>document.querySelectorAll('.tab-btn[data-game]').forEach(t=>t.classList.toggle('active',t.dataset.game===game));
  const boot=async()=>{ensureSupportUI();installLayoutFixes();installReleaseMoniker();const games=await discoverGames();if(!games.length)return;updateTabs(games);document.querySelector('.tabs-container')?.addEventListener('click',e=>{const b=e.target.closest('.tab-btn[data-game]');if(b)renderGame(b.dataset.game).catch(console.error);});const g=window.JASPER_DEFAULT_GAME&&games.includes(window.JASPER_DEFAULT_GAME)?window.JASPER_DEFAULT_GAME:games.includes(DEFAULT_GAME)?DEFAULT_GAME:games[0];await renderGame(g);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
