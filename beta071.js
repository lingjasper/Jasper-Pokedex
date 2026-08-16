(() => {
  'use strict';

  const BASE = 'beta071-base.js';
  const BETA_LABEL = window.JASPER_POKEDEX_VERSION;
  const TOKEN_KEY = 'jasper_pokedex_github_token';
  const SHA_KEY = 'jasper_pokedex_save_sha';
  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const LAST_SYNC_KEY = 'jasper_pokedex_last_synced_at';
  const API = 'https://api.github.com/repos/lingjasper/Jasper-Pokedex';
  const TOTAL_DEX = 300;
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const state = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch { return {}; } };

  const installOneShotBodyObserverGuard = () => {
    const NativeObserver = window.MutationObserver;
    if (!NativeObserver || window.__jasperObserverGuardInstalled) return () => {};
    window.__jasperObserverGuardInstalled = true;
    class GuardedMutationObserver {
      constructor(callback) {
        this._oneShotBody = false;
        this._observer = new NativeObserver((records, observer) => {
          try { callback(records, observer); }
          finally { if (this._oneShotBody) observer.disconnect(); }
        });
      }
      observe(target, options) {
        this._oneShotBody = target === document.body && !!options?.childList && !!options?.subtree;
        return this._observer.observe(target, options);
      }
      disconnect() { return this._observer.disconnect(); }
      takeRecords() { return this._observer.takeRecords(); }
    }
    window.MutationObserver = GuardedMutationObserver;
    return () => { window.MutationObserver = NativeObserver; };
  };

  const b64decode = value => { const binary=atob(value.replace(/\n/g,'')); const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)); return new TextDecoder().decode(bytes); };
  const request = async (url, options={}) => {
    const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(options.headers||{})};
    if(token()) headers.Authorization=`Bearer ${token()}`;
    const response=await fetch(url,{...options,headers}); const body=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(body.message||`GitHub API error ${response.status}`);error.status=response.status;throw error;} return body;
  };
  const setPill = (label,type) => {
    const pill=document.getElementById('githubSyncPill'), icon=document.getElementById('githubSyncIcon'), text=pill?.querySelector('.github-sync-label');
    if(text && text.textContent!==label) text.textContent=label;
    if(pill && pill.dataset.state!==type) pill.dataset.state=type;
    if(icon){const cls=`github-sync-icon ${type==='busy'?'spinning':''}`;if(icon.className!==cls)icon.className=cls;const glyph=type==='ok'?'✓':type==='busy'?'↻':type==='warning'?'!':'×';if(icon.textContent!==glyph)icon.textContent=glyph;}
  };
  const setStatus=(text,type='normal')=>{const status=document.getElementById('githubSyncStatus');if(status){if(status.textContent!==text)status.textContent=text;status.dataset.type=type;}setPill(type==='ok'?'Synced':type==='busy'?'Syncing...':type==='error'?'Sync Error':token()?'Synced':'Token Sync',type==='error'?'warning':type);};
  const formatLastSync=value=>{if(!value)return'';const date=new Date(value);if(Number.isNaN(date.getTime()))return'';return`Last modified on ${date.toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).replace(' AM','am').replace(' PM','pm')}.`;};
  const updateLastSync=value=>{if(value)localStorage.setItem(LAST_SYNC_KEY,value);const el=document.getElementById('githubLastSynced');if(el)el.textContent=formatLastSync(value||localStorage.getItem(LAST_SYNC_KEY));};
  const setTokenUI=active=>{const input=document.getElementById('githubTokenInput'),activate=document.getElementById('githubConnectBtn'),change=document.getElementById('githubChangeTokenBtn');if(!input)return;input.type='text';input.value=active?'****************':'';input.disabled=active;if(activate)activate.hidden=active;if(change)change.hidden=!active;};
  const updateBanner=()=>{const banner=document.getElementById('dexProgressBanner');if(!banner)return;const saved=state();const cells=[...document.querySelectorAll('#boxContainer .cell:not(.empty)')];const registered=Math.min(TOTAL_DEX,cells.filter(cell=>!!saved[cell.dataset.id]).length);const text=banner.querySelector('.dex-progress-text');if(text)text.textContent=`${registered} of ${TOTAL_DEX} Pokémon registered · ${TOTAL_DEX-registered} remaining · ${Math.round(registered/TOTAL_DEX*100)}% complete`;};

  // Remove only the additional forms. Keep the single base Pokédex entries for #297–#300.
  const removeLegacyDuplicateForms = () => {
    const variant = /^(White Kyurem|Black Kyurem|Resolute Keldeo|Pirouette Meloetta|Shock Drive Genesect|Burn Drive Genesect|Chill Drive Genesect|Douse Drive Genesect)$/i;
    document.querySelectorAll('.cell[data-name], .list-row[data-name]').forEach(el => {
      if (variant.test((el.dataset.name || '').trim())) el.remove();
    });
    document.querySelectorAll('.cell:not([data-name]), .list-row:not([data-name])').forEach(el => {
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      if (variant.test(text)) el.remove();
    });
  };

  const loadRemote=async()=>{if(!token())return;setStatus('Loading from GitHub...','busy');try{const file=await request(`${API}/contents/save.json?ref=main`);const payload=JSON.parse(b64decode(file.content));localStorage.setItem(SHA_KEY,file.sha);localStorage.setItem(STATE_KEY,JSON.stringify(payload.pokemon||{}));updateLastSync(payload.updatedAt||null);setTokenUI(true);setStatus('Synced','ok');updateBanner();}catch(error){if(error.status===404){setTokenUI(true);setStatus('Connected — save will be created on your next change.','ok');updateLastSync();}else if(error.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);setTokenUI(false);setStatus('GitHub token is invalid or expired.','error');}else setStatus(`Could not load GitHub save: ${error.message}`,'error');}};
  const connect=async()=>{const input=document.getElementById('githubTokenInput'),value=input?.value.trim();if(!value||value==='****************')return;localStorage.setItem(TOKEN_KEY,value);setStatus('Verifying GitHub token...','busy');try{await request(`${API}/contents/save.json?ref=main`);localStorage.removeItem(SHA_KEY);setTokenUI(true);await loadRemote();}catch(error){if(error.status===404){localStorage.removeItem(SHA_KEY);setTokenUI(true);setStatus('Connected — save will be created on your next change.','ok');}else{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);setTokenUI(false);setStatus(error.status===401?'GitHub token is invalid or expired.':`Connection failed: ${error.message}`,'error');}}};

  const positionSyncMenu=()=>{
    const wrap=document.getElementById('githubSyncWrap'),pill=document.getElementById('githubSyncPill'),menu=document.getElementById('githubSyncMenu');
    if(!wrap||!pill||!menu)return;
    const rect=pill.getBoundingClientRect();
    menu.style.position='fixed';
    menu.style.top=`${Math.round(rect.bottom+8)}px`;
    menu.style.right=`${Math.max(8,Math.round(window.innerWidth-rect.right))}px`;
    menu.style.left='auto';
    menu.style.zIndex='2147483647';
  };

  const installDesktopSyncUI=()=>{
    if(isMobile())return;const top=document.getElementById('desktopWorkspaceTop'),workspace=document.getElementById('desktopWorkspace'),table=document.getElementById('desktopTableContainer');if(!top||!workspace||!table)return;
    let wrap=document.getElementById('githubSyncWrap');
    if(!wrap){wrap=document.createElement('div');wrap.id='githubSyncWrap';wrap.innerHTML=`<button id="githubSyncPill" type="button" data-state="normal" aria-expanded="false"><span id="githubSyncIcon" class="github-sync-icon">×</span><span class="github-sync-label">Token Sync</span><span class="github-sync-chevron" aria-hidden="true"></span></button><div id="githubSyncMenu" role="menu"><div id="githubSyncStatus">Not connected — enter a GitHub token to sync.</div><div id="githubLastSynced"></div><div id="githubSyncControls"><input id="githubTokenInput" type="password" autocomplete="off" placeholder="GitHub token"><button id="githubConnectBtn" type="button">Activate Token</button><button id="githubChangeTokenBtn" type="button" hidden>Change Token</button></div><p id="githubSyncNote">Your token stays in this browser and is never committed to GitHub.</p></div>`;top.appendChild(wrap);
      document.getElementById('githubSyncPill').addEventListener('click',event=>{event.stopPropagation();const open=wrap.classList.toggle('open');document.getElementById('githubSyncPill').setAttribute('aria-expanded',String(open));if(open)requestAnimationFrame(positionSyncMenu);updateLastSync();});
      document.getElementById('githubConnectBtn').addEventListener('click',connect);
      document.getElementById('githubChangeTokenBtn').addEventListener('click',()=>{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);setTokenUI(false);setStatus('Enter a new GitHub token to activate sync.');});
      document.addEventListener('click',event=>{if(!wrap.contains(event.target))wrap.classList.remove('open');});
      window.addEventListener('resize',()=>{if(wrap.classList.contains('open'))positionSyncMenu();});
      window.addEventListener('scroll',()=>{if(wrap.classList.contains('open'))positionSyncMenu();},{passive:true});
    }
    let banner=document.getElementById('dexProgressBanner');if(!banner){banner=document.createElement('div');banner.id='dexProgressBanner';banner.innerHTML='<span class="dex-progress-icon">i</span><span class="dex-progress-text"></span>';workspace.insertBefore(banner,table);}else if(banner.parentElement!==workspace)workspace.insertBefore(banner,table);
    const controls=document.querySelector('.controls-container');if(controls&&!table.querySelector('.desktop-controls-separator')){const separator=document.createElement('div');separator.className='desktop-controls-separator';controls.insertAdjacentElement('afterend',separator);}
    const sidebar=document.getElementById('desktopSidebar');if(sidebar){const subheader=sidebar.querySelector('.desktop-sidebar-subheader');if(subheader){subheader.textContent='Titles';subheader.style.textTransform='none';}const beta=sidebar.querySelector('.desktop-sidebar-brand .beta');if(beta)beta.textContent=BETA_LABEL;}
    const mobileBeta=document.getElementById('pokedexBetaMoniker');if(mobileBeta)mobileBeta.textContent=BETA_LABEL;
    const setViewLabel=(id,label)=>{const button=document.getElementById(id);if(!button)return;[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());button.appendChild(document.createTextNode(` ${label}`));};setViewLabel('boxViewBtn','Box view');setViewLabel('listViewBtn','List view');
    removeLegacyDuplicateForms();updateBanner();
    if(token()){setTokenUI(true);updateLastSync();if(!sessionStorage.getItem('jasper_pokedex_desktop_loaded')){sessionStorage.setItem('jasper_pokedex_desktop_loaded','1');loadRemote();}}else setPill('Token Sync','normal');
    const cells=document.getElementById('boxContainer');if(cells&&!cells.dataset.beta083Observed){cells.dataset.beta083Observed='1';new MutationObserver(updateBanner).observe(cells,{subtree:true,attributes:true,attributeFilter:['class']});}
  };

  const injectFixStyles=()=>{if(document.getElementById('beta085Styles'))return;const style=document.createElement('style');style.id='beta085Styles';style.textContent=`@media(min-width:641px){.desktop-sidebar-subheader{text-transform:none!important;letter-spacing:0!important;font-size:.82rem!important;font-weight:700!important}#desktopWorkspaceTop #githubSyncWrap{display:block!important;visibility:visible!important;opacity:1!important;z-index:2147483646!important;position:relative!important}#githubSyncPill{position:relative;z-index:2147483646!important}#githubSyncMenu{z-index:2147483647!important;position:fixed!important;max-height:calc(100vh - 24px);overflow-y:auto}.github-sync-icon.spinning{animation:githubSyncSpin 1s linear infinite}@keyframes githubSyncSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}#desktopWorkspace #dexProgressBanner{display:flex!important;visibility:visible!important;opacity:1!important;position:relative;z-index:100!important}.desktop-controls-separator{height:0;border-top:2px solid #cbd5e1!important;margin:0 0 16px;flex:0 0 auto;width:100%}#githubSyncNote{font-size:.65rem!important;line-height:1.3!important;margin-top:8px!important}.cell .dex-num{margin-right:4px}.cell .name{margin-top:6px!important}.cell .checkbox{margin-left:4px}}`;document.head.appendChild(style);};
  const repair=()=>{if(isMobile())return;injectFixStyles();installDesktopSyncUI();};
  const loadBase=()=>{const restoreObserver=installOneShotBodyObserverGuard();const script=document.createElement('script');script.src=BASE;script.onload=()=>{restoreObserver();setTimeout(repair,0);};script.onerror=()=>{restoreObserver();};document.head.appendChild(script);};
  loadBase();
})();
