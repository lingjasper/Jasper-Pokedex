(() => {
  'use strict';

  /* Beta v0.11 synchronization owner.
   * Remote save.json is the cloud source of truth. This module owns token,
   * remote load/save, SHA tracking, and Sync Pill state. It does not render
   * Pokémon, counters, forms, or boxes. */
  const TOKEN_KEY = 'jasper_pokedex_github_token';
  const SHA_KEY = 'jasper_pokedex_save_sha';
  const LAST_SYNC_KEY = 'jasper_pokedex_last_synced_at';
  const STATE_KEY = 'jasper_pokedex_state_White2';
  const LEGACY_KEY = 'b2w2_living_dex_saved_state';
  const API = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex';
  const SAVE_URL = `${API}/contents/save.json?ref=main`;
  let remoteReady = false;
  let saveTimer = null;
  let busy = false;
  let suppressSave = false;

  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const getState = () => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch { return {}; }
  };
  const setState = state => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
  };
  const b64 = bytes => { let s=''; for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(s); };
  const encode = text => b64(new TextEncoder().encode(text));
  const decode = value => { const b=atob(value.replace(/\n/g,'')); return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0))); };

  const request = async (url, options={}) => {
    const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(options.headers||{})};
    if(token()) headers.Authorization=`Bearer ${token()}`;
    const response=await fetch(url,{...options,headers});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(body.message||`GitHub API error ${response.status}`);error.status=response.status;throw error;}
    return body;
  };

  const pill = (label,type) => {
    const wrap=document.getElementById('githubSyncWrap'), p=document.getElementById('githubSyncPill'), i=document.getElementById('githubSyncIcon');
    const text=p?.querySelector('.github-sync-label');
    if(text)text.textContent=label;
    if(p)p.dataset.state=type;
    if(i){
      i.className='github-sync-icon';
      i.textContent='';
      const map={ok:['sync','success'],busy:['sync','inProgress'],warning:['sync','warning'],normal:['sync','tokenNeeded']};
      const pair=map[type]||map.normal;
      if(window.JasperIcon)window.JasperIcon.replace(i,pair[0],pair[1],{className:'icon-rendered'});
    }
    if(wrap)wrap.dataset.syncState=type;
  };
  window.JASPER_SYNC_SET_PILL = pill;

  const status = (text,type='normal') => {
    const el=document.getElementById('githubSyncStatus'); if(el){el.textContent=text;el.dataset.type=type;}
    pill(type==='ok'?'Synced':type==='busy'?'Syncing...':type==='error'?'Sync Error':token()?'Token Sync':'Token Sync',type==='error'?'warning':type);
  };
  const lastSync = value => {
    if(value)localStorage.setItem(LAST_SYNC_KEY,value);
    const el=document.getElementById('githubLastSynced');
    if(!el)return;
    const raw=value||localStorage.getItem(LAST_SYNC_KEY); if(!raw){el.textContent='';return;}
    const date=new Date(raw); if(Number.isNaN(date.getTime())){el.textContent='';return;}
    el.textContent=`Last modified on ${date.toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).replace(' AM','am').replace(' PM','pm')}.`;
  };
  const tokenUI = active => {
    const input=document.getElementById('githubTokenInput'), connect=document.getElementById('githubConnectBtn'), change=document.getElementById('githubChangeTokenBtn'); if(!input)return;
    input.disabled=active;input.type=active?'text':'password';input.value=active?'****************':'';
    if(connect)connect.hidden=active;if(change)change.hidden=!active;
  };

  const getRemote = async () => {
    const file=await request(SAVE_URL); const payload=JSON.parse(decode(file.content));
    return {state:payload.pokemon||{},sha:file.sha,updatedAt:payload.updatedAt||null};
  };

  const notifyRenderer = game => window.dispatchEvent(new CustomEvent('jasper:pokedex-state-synced',{detail:{game:game||'White2',sha:localStorage.getItem(SHA_KEY)}}));

  const saveRemote = async () => {
    if(!token()||busy)return;
    busy=true;status('Syncing...','busy');
    try{
      let sha=localStorage.getItem(SHA_KEY);
      if(!sha){try{sha=(await getRemote()).sha;}catch(e){if(e.status!==404)throw e;}}
      const updatedAt=new Date().toISOString();
      const payload={version:1,updatedAt,pokemon:getState()};
      const body={message:'Update Pokedex progress',content:encode(JSON.stringify(payload,null,2)+'\n'),branch:'main'};
      if(sha)body.sha=sha;
      const result=await request(`${API}/contents/save.json`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(result.content?.sha)localStorage.setItem(SHA_KEY,result.content.sha);
      lastSync(updatedAt);status('Synced','ok');notifyRenderer('White2');
    }catch(e){
      if(e.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);tokenUI(false);status('GitHub token is invalid or expired.','error');}
      else if(e.status===409)status('GitHub changed; sync again before saving.','error');
      else status(`Sync failed: ${e.message}`,'error');
    }finally{busy=false;}
  };
  const scheduleSave=()=>{clearTimeout(saveTimer);if(remoteReady)saveTimer=setTimeout(saveRemote,900);};

  const loadRemote = async () => {
    if(!token()){remoteReady=true;status('Not connected — enter a GitHub token to sync.');return;}
    remoteReady=false;status('Loading from GitHub...','busy');
    try{
      const remote=await getRemote();
      localStorage.setItem(SHA_KEY,remote.sha);lastSync(remote.updatedAt);
      suppressSave=true;setState(remote.state);suppressSave=false;remoteReady=true;
      status('Synced','ok');
      // No location.reload(). Renderer receives the new state and paints it immediately.
      notifyRenderer('White2');
    }catch(e){
      suppressSave=false;remoteReady=true;
      if(e.status===404){status('Save not found; your next change will create it.');notifyRenderer('White2');}
      else if(e.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);tokenUI(false);status('GitHub token is invalid or expired.','error');}
      else status(`Could not load GitHub save: ${e.message}`,'error');
    }
  };

  const connect=async()=>{
    const input=document.getElementById('githubTokenInput'),value=input?.value.trim();
    if(!value||value==='****************'){status('Paste your GitHub token first.','error');return;}
    localStorage.setItem(TOKEN_KEY,value);localStorage.removeItem(SHA_KEY);status('Verifying GitHub token...','busy');
    try{await getRemote();tokenUI(true);await loadRemote();}
    catch(e){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);tokenUI(false);status(e.status===401?'GitHub token is invalid or expired.':`Connection failed: ${e.message}`,'error');}
  };

  const installUI=()=>{
    if(document.getElementById('githubSyncWrap'))return;
    const wrap=document.createElement('div');wrap.id='githubSyncWrap';
    wrap.innerHTML=`<button id="githubSyncPill" type="button" data-state="normal" aria-expanded="false"><span id="githubSyncIcon" class="github-sync-icon" aria-hidden="true"></span><span class="github-sync-label">Token Sync</span><span class="github-sync-chevron" aria-hidden="true"></span></button><div id="githubSyncMenu" role="menu"><div id="githubSyncStatus">Not connected — enter a GitHub token to sync.</div><div id="githubLastSynced"></div><div id="githubSyncControls"><input id="githubTokenInput" type="password" autocomplete="off" placeholder="GitHub token"><button id="githubConnectBtn" type="button">Activate Token</button><button id="githubChangeTokenBtn" type="button" hidden>Change Token</button></div><p id="githubSyncNote">Your token stays in this browser and is never committed to GitHub.</p></div>`;
    document.body.appendChild(wrap);
    const style=document.createElement('style');style.id='v011SyncStyles';style.textContent=`#githubSyncWrap{position:relative;z-index:12000;flex-shrink:0}#githubSyncPill{display:flex;align-items:center;gap:7px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:7px 10px;font:600 .82rem inherit;cursor:pointer;box-shadow:0 1px 3px rgba(15,23,42,.08)}.github-sync-icon{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}.github-sync-icon.spinning{animation:none!important}@keyframes v011spin{to{transform:rotate(360deg)}}#githubSyncPill[data-state="normal"] .github-sync-icon{color:#dc2626}#githubSyncPill[data-state="ok"] .github-sync-icon{color:#16a34a}#githubSyncPill[data-state="busy"] .github-sync-icon{color:#2563eb}#githubSyncPill[data-state="warning"] .github-sync-icon{color:#ca8a04}#githubSyncMenu{display:none;position:absolute;top:calc(100% + 8px);right:0;width:min(360px,calc(100vw - 16px));background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:12px;box-shadow:0 16px 36px rgba(15,23,42,.2);z-index:13000}#githubSyncWrap.open #githubSyncMenu{display:block}#githubSyncStatus{font-size:.82rem;color:#64748b;margin-bottom:4px}#githubLastSynced{font-size:.76rem;color:#64748b;margin-bottom:10px}#githubSyncControls{display:flex;gap:8px;align-items:center}#githubTokenInput{flex:1;min-width:0;padding:9px 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}#githubSyncControls button{padding:9px 11px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;font-weight:600;cursor:pointer}#githubSyncNote{font-size:.65rem;line-height:1.3;color:#64748b;margin:8px 0 0}@media(max-width:640px){#githubSyncWrap{position:absolute;top:10px;right:8px}#githubSyncMenu{position:fixed;top:58px;right:8px;left:8px;width:auto}body{padding-top:72px}}`;
    document.head.appendChild(style);
    const pillButton=document.getElementById('githubSyncPill');
    pillButton.onclick=e=>{e.stopPropagation();const open=wrap.classList.toggle('open');pillButton.setAttribute('aria-expanded',String(open));};
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))wrap.classList.remove('open');});
    document.getElementById('githubConnectBtn').onclick=connect;
    document.getElementById('githubChangeTokenBtn').onclick=()=>{clearTimeout(saveTimer);localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);remoteReady=false;tokenUI(false);status('Enter a new GitHub token to activate sync.');};
    if(token()){tokenUI(true);lastSync();}
  };

  const installStorageHook=()=>{
    const native=Storage.prototype.setItem;
    if(window.__jasperSyncStorageHook)return;
    window.__jasperSyncStorageHook=true;
    Storage.prototype.setItem=function(k,v){native.call(this,k,v);if(this===localStorage&&k===STATE_KEY&&!suppressSave&&remoteReady)scheduleSave();};
    window.__jasperSyncNativeSetItem=native;
  };

  const boot=()=>{installUI();installStorageHook();if(token())loadRemote();else{remoteReady=true;status('Not connected — enter a GitHub token to sync.');}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
