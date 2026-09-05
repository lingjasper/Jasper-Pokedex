(() => {
  'use strict';

  /* v1.0.1 — game-scoped GitHub persistence. This module owns token, remote
   * load/save, SHA tracking, and Sync Pill state. It does not render Pokémon. */
  const TOKEN_KEY='jasper_pokedex_github_token';
  const SHA_PREFIX='jasper_pokedex_save_sha_';
  const LAST_SYNC_PREFIX='jasper_pokedex_last_synced_at_';
  const API='https://api.github.com/repos/Jasper-Pokedex/placeholder';
  const REPO='https://api.github.com/repos/lingjasper/Jasper-Pokedex';
  const LEGACY_SAVE_URL=`${REPO}/contents/save.json?ref=main`;
  let saveTimers=new Map(),busy=new Set(),suppressSave=false,readyGames=new Set();

  const game=()=>window.JASPER_ACTIVE_GAME||'pokemon-white-2';
  const shaKey=g=>`${SHA_PREFIX}${g}`;
  const lastKey=g=>`${LAST_SYNC_PREFIX}${g}`;
  const token=()=>localStorage.getItem(TOKEN_KEY)||'';
  const cfg=g=>window.JASPER_POKEDEX?.gameConfig||null;
  const savePath=g=>cfg(g)?.save||`saves/${g}.json`;
  const saveUrl=g=>`${REPO}/contents/${savePath(g)}?ref=main`;
  const stateKey=g=>`jasper_pokedex_state_${g}`;
  const getState=g=>{try{return JSON.parse(localStorage.getItem(stateKey(g))||'{}')}catch{return{}}};
  const setState=(g,state)=>localStorage.setItem(stateKey(g),JSON.stringify(state));
  const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);};
  const encode=text=>b64(new TextEncoder().encode(text));
  const decode=value=>{const b=atob(value.replace(/\n/g,''));return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)));};
  const request=async(url,options={})=>{const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(options.headers||{})};if(token())headers.Authorization=`Bearer ${token()}`;const response=await fetch(url,{...options,headers});const body=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(body.message||`GitHub API error ${response.status}`);error.status=response.status;throw error;}return body;};

  const pill=(label,type)=>{const wrap=document.getElementById('githubSyncWrap'),p=document.getElementById('githubSyncPill'),i=document.getElementById('githubSyncIcon'),text=p?.querySelector('.github-sync-label');if(text)text.textContent=label;if(p)p.dataset.state=type;if(i){i.className=`github-sync-icon ${type==='busy'?'spinning':''}`;i.textContent=type==='ok'?'✓':type==='busy'?'↻':type==='warning'?'!':'×';}if(wrap)wrap.dataset.syncState=type;};
  window.JASPER_SYNC_SET_PILL=pill;
  const status=(text,type='normal')=>{const el=document.getElementById('githubSyncStatus');if(el){el.textContent=text;el.dataset.type=type;}pill(type==='ok'?'Synced':type==='busy'?'Syncing...':type==='error'?'Sync Error':token()?'Token Sync':'Token Sync',type==='error'?'warning':type);};
  const lastSync=(g,value)=>{if(value)localStorage.setItem(lastKey(g),value);const el=document.getElementById('githubLastSynced');if(!el)return;const raw=value||localStorage.getItem(lastKey(g));if(!raw){el.textContent='';return;}const date=new Date(raw);if(Number.isNaN(date.getTime())){el.textContent='';return;}el.textContent=`Last modified on ${date.toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).replace(' AM','am').replace(' PM','pm')}.`;};
  const tokenUI=active=>{const input=document.getElementById('githubTokenInput'),connect=document.getElementById('githubConnectBtn'),change=document.getElementById('githubChangeTokenBtn');if(!input)return;input.disabled=active;input.type=active?'text':'password';input.value=active?'****************':'';if(connect)connect.hidden=active;if(change)change.hidden=!active;};

  const getRemote=async g=>{const file=await request(saveUrl(g));const payload=JSON.parse(decode(file.content));return{state:payload.pokemon||{},sha:file.sha,updatedAt:payload.updatedAt||null};};
  const getLegacyRemote=async()=>{const file=await request(LEGACY_SAVE_URL);const payload=JSON.parse(decode(file.content));return{state:payload.pokemon||{},sha:file.sha,updatedAt:payload.updatedAt||null};};
  const notifyRenderer=g=>window.dispatchEvent(new CustomEvent('jasper:pokedex-state-synced',{detail:{game:g,sha:localStorage.getItem(shaKey(g))}}));

  const migrateLegacyState=g=>{
    if(g!=='pokemon-white-2'||!window.JASPER_POKEDEX?.pokemon)return null;
    const source=getState(g),p=window.JASPER_POKEDEX.pokemon,aliases={};
    const seen=new Map();
    p.forEach(q=>{const n=seen.get(q.num)||0;seen.set(q.num,n+1);aliases[n?`${q.num}-${n}`:q.num]=q.id;if(q.form){const f=q.form.replace(/^\(|\)$/g,'').toLowerCase();aliases[`${q.num}-${f}`]=q.id;if(f==='male')aliases[`${q.num}-M`]=q.id;if(f==='female')aliases[`${q.num}-F`]=q.id;}});
    const valid=new Set(p.map(q=>q.id)),out={};Object.entries(source).forEach(([k,v])=>{const id=valid.has(k)?k:aliases[k];if(id)out[id]=v===true;});return out;
  };

  const saveRemote=async g=>{
    if(!token()||busy.has(g))return;busy.add(g);status('Syncing...','busy');
    try{
      let sha=localStorage.getItem(shaKey(g));
      if(!sha){try{sha=(await getRemote(g)).sha;}catch(e){if(e.status!==404)throw e;}}
      const updatedAt=new Date().toISOString();
      const payload={version:1,gameId:g,updatedAt,pokemon:getState(g)};
      const body={message:`Update ${g} Pokedex progress`,content:encode(JSON.stringify(payload,null,2)+'\n'),branch:'main'};if(sha)body.sha=sha;
      const result=await request(`${REPO}/contents/${savePath(g)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(result.content?.sha)localStorage.setItem(shaKey(g),result.content.sha);lastSync(g,updatedAt);readyGames.add(g);status('Synced','ok');notifyRenderer(g);
    }catch(e){
      if(e.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(shaKey(g));tokenUI(false);status('GitHub token is invalid or expired.','error');}
      else if(e.status===409)status('GitHub changed; sync again before saving.','error');
      else status(`Sync failed: ${e.message}`,'error');
    }finally{busy.delete(g);}
  };
  const scheduleSave=g=>{clearTimeout(saveTimers.get(g));if(readyGames.has(g))saveTimers.set(g,setTimeout(()=>saveRemote(g),900));};

  const loadRemote=async g=>{
    if(!token()){readyGames.add(g);status('Not connected — enter a GitHub token to sync.');return;}
    readyGames.delete(g);status('Loading from GitHub...','busy');
    try{
      let remote;
      try{remote=await getRemote(g);}catch(e){
        if(e.status!==404)throw e;
        if(g==='pokemon-white-2'){
          try{remote=await getLegacyRemote();}catch(legacy){if(legacy.status!==404)throw legacy;remote=null;}
        }
      }
      if(remote){
        localStorage.setItem(shaKey(g),remote.sha);lastSync(g,remote.updatedAt);suppressSave=true;setState(g,remote.state);suppressSave=false;
      }else{
        const migrated=migrateLegacyState(g);if(migrated){suppressSave=true;setState(g,migrated);suppressSave=false;}
      }
      readyGames.add(g);status('Synced','ok');notifyRenderer(g);
    }catch(e){
      suppressSave=false;readyGames.add(g);
      if(e.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(shaKey(g));tokenUI(false);status('GitHub token is invalid or expired.','error');}
      else status(`Could not load GitHub save: ${e.message}`,'error');
    }
  };

  const connect=async()=>{const input=document.getElementById('githubTokenInput'),value=input?.value.trim();if(!value||value==='****************'){status('Paste your GitHub token first.','error');return;}localStorage.setItem(TOKEN_KEY,value);localStorage.removeItem(shaKey(game()));status('Verifying GitHub token...','busy');try{await loadRemote(game());tokenUI(true);}catch(e){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(shaKey(game()));tokenUI(false);status(e.status===401?'GitHub token is invalid or expired.':`Connection failed: ${e.message}`,'error');}};

  const installUI=()=>{if(document.getElementById('githubSyncWrap'))return;const wrap=document.createElement('div');wrap.id='githubSyncWrap';wrap.innerHTML=`<button id="githubSyncPill" type="button" data-state="normal" aria-expanded="false"><span id="githubSyncIcon" class="github-sync-icon">×</span><span class="github-sync-label">Token Sync</span><span class="github-sync-chevron" aria-hidden="true"></span></button><div id="githubSyncMenu" role="menu"><div id="githubSyncStatus">Not connected — enter a GitHub token to sync.</div><div id="githubLastSynced"></div><div id="githubSyncControls"><input id="githubTokenInput" type="password" autocomplete="off" placeholder="GitHub token"><button id="githubConnectBtn" type="button">Activate Token</button><button id="githubChangeTokenBtn" type="button" hidden>Change Token</button></div><p id="githubSyncNote">Your token stays in this browser and is never committed to GitHub.</p></div>`;document.body.appendChild(wrap);const style=document.createElement('style');style.id='v011SyncStyles';style.textContent=`#githubSyncWrap{position:relative;z-index:12000;flex-shrink:0}#githubSyncPill{display:flex;align-items:center;gap:7px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:7px 10px;font:600 .82rem inherit;cursor:pointer;box-shadow:0 1px 3px rgba(15,23,42,.08)}.github-sync-icon{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid currentColor;line-height:1;flex-shrink:0}.github-sync-icon.spinning{animation:v011spin 1s linear infinite}@keyframes v011spin{to{transform:rotate(360deg)}}#githubSyncPill[data-state="normal"] .github-sync-icon{color:#dc2626}#githubSyncPill[data-state="ok"] .github-sync-icon{color:#16a34a}#githubSyncPill[data-state="busy"] .github-sync-icon{color:#2563eb}#githubSyncPill[data-state="warning"] .github-sync-icon{color:#ca8a04}#githubSyncMenu{display:none;position:absolute;top:calc(100% + 8px);right:0;width:min(360px,calc(100vw - 16px));background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:12px;box-shadow:0 16px 36px rgba(15,23,42,.2);z-index:13000}#githubSyncWrap.open #githubSyncMenu{display:block}#githubSyncStatus{font-size:.82rem;color:#64748b;margin-bottom:4px}#githubLastSynced{font-size:.76rem;color:#64748b;margin-bottom:10px}#githubSyncControls{display:flex;gap:8px;align-items:center}#githubTokenInput{flex:1;min-width:0;padding:9px 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}#githubSyncControls button{padding:9px 11px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;font-weight:600;cursor:pointer}#githubSyncNote{font-size:.65rem;line-height:1.3;color:#64748b;margin:8px 0 0}@media(max-width:640px){#githubSyncWrap{position:absolute;top:10px;right:8px}#githubSyncMenu{position:fixed;top:58px;right:8px;left:8px;width:auto}body{padding-top:72px}}`;document.head.appendChild(style);const pillButton=document.getElementById('githubSyncPill');pillButton.onclick=e=>{e.stopPropagation();const open=wrap.classList.toggle('open');pillButton.setAttribute('aria-expanded',String(open));};document.addEventListener('click',e=>{if(!wrap.contains(e.target))wrap.classList.remove('open');});document.getElementById('githubConnectBtn').onclick=connect;document.getElementById('githubChangeTokenBtn').onclick=()=>{for(const t of saveTimers.values())clearTimeout(t);saveTimers.clear();localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(shaKey(game()));readyGames.clear();tokenUI(false);status('Enter a new GitHub token to activate sync.');};if(token()){tokenUI(true);lastSync(game());}};

  const installStorageHook=()=>{if(window.__jasperSyncStorageHook)return;const native=Storage.prototype.setItem;window.__jasperSyncStorageHook=true;window.__jasperSyncNativeSetItem=native;Storage.prototype.setItem=function(k,v){native.call(this,k,v);const g=game();if(this===localStorage&&k===stateKey(g)&&!suppressSave&&readyGames.has(g))scheduleSave(g);};};
  window.addEventListener('jasper:pokedex-game-changed',e=>loadRemote(e.detail?.game||game()).catch(console.error));
  const boot=()=>{installUI();installStorageHook();if(token())loadRemote(game());else{readyGames.add(game());status('Not connected — enter a GitHub token to sync.');}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
