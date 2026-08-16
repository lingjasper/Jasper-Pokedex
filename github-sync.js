(() => {
  const STATE_KEY = "b2w2_living_dex_saved_state";
  const TOKEN_KEY = "jasper_pokedex_github_token";
  const SHA_KEY = "jasper_pokedex_save_sha";
  const RELOAD_KEY = "jasper_pokedex_remote_reload_sha";
  const LAST_SYNC_KEY = "jasper_pokedex_last_synced_at";
  const API = "https://api.github.com/repos/lingjasper/Jasper-Pokedex";
  const SAVE = "/contents/save.json?ref=main";
  const TOTAL_DEX = 300;
  let remoteReady = false, timer = null, busy = false, suppressSave = false;

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && key === STATE_KEY && remoteReady && !suppressSave) scheduleSave();
  };
  const token = () => localStorage.getItem(TOKEN_KEY) || "";
  const state = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch { return {}; } };
  const isMobile = () => matchMedia("(max-width:640px)").matches;
  const b64 = bytes => { let s=""; for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(s); };
  const text64 = text => b64(new TextEncoder().encode(text));
  const from64 = value => { const b=atob(value.replace(/\n/g,"")); return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0))); };
  const request = async (url, options={}) => {
    const headers={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10",...(options.headers||{})};
    if(token()) headers.Authorization=`Bearer ${token()}`;
    const r=await fetch(url,{...options,headers}); const body=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(body.message||`GitHub API error ${r.status}`);e.status=r.status;throw e;} return body;
  };
  const formatLastSync = value => {
    if(!value)return ""; const d=new Date(value); if(Number.isNaN(d.getTime()))return "";
    return `Last modified on ${d.toLocaleString("en-US",{month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).replace(" AM","am").replace(" PM","pm")}.`;
  };
  const updateLastSyncedUI = value => {
    if(value)localStorage.setItem(LAST_SYNC_KEY,value);
    const el=document.getElementById("githubLastSynced"); if(el)el.textContent=formatLastSync(value||localStorage.getItem(LAST_SYNC_KEY));
  };
  const setPillState = type => {
    const pill=document.getElementById("githubSyncPill"),icon=document.getElementById("githubSyncIcon"); if(!pill||!icon)return;
    pill.dataset.state=type; icon.className="github-sync-icon "+(type==="busy"?"spinning":"");
    icon.textContent=type==="ok"?"✓":type==="busy"?"↻":type==="warning"?"!":"×";
  };
  const status = (text,type="normal") => {
    const el=document.getElementById("githubSyncStatus"); if(el){el.textContent=text;el.dataset.type=type;}
    setPillState(type==="ok"?"ok":type==="busy"?"busy":type==="error"?"warning":token()?"ok":"normal");
  };
  const setTokenUI = active => {
    const input=document.getElementById("githubTokenInput"),activate=document.getElementById("githubConnectBtn"),change=document.getElementById("githubChangeTokenBtn"); if(!input)return;
    if(active){input.type="text";input.value="****************";input.disabled=true;if(activate)activate.hidden=true;if(change)change.hidden=false;}
    else{input.type="password";input.value="";input.disabled=false;if(activate)activate.hidden=false;if(change)change.hidden=true;}
  };
  const getRemote = async () => { const file=await request(`${API}${SAVE}`),data=JSON.parse(from64(file.content)); return {state:data.pokemon||{},sha:file.sha,updatedAt:data.updatedAt||null}; };
  const saveRemote = async () => {
    if(!token()||busy)return; busy=true; status("Syncing...","busy");
    try{
      let sha=localStorage.getItem(SHA_KEY); if(!sha){try{sha=(await getRemote()).sha;}catch(e){if(e.status!==404)throw e;}}
      const updatedAt=new Date().toISOString(),payload={version:1,updatedAt,pokemon:state()};
      const body={message:"Update Pokedex progress",content:text64(JSON.stringify(payload,null,2)+"\n"),branch:"main"}; if(sha)body.sha=sha;
      const result=await request(`${API}/contents/save.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(result.content?.sha)localStorage.setItem(SHA_KEY,result.content.sha); updateLastSyncedUI(updatedAt); status("Synced ✓","ok"); updateProgressBanner();
    }catch(e){
      if(e.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);setTokenUI(false);status("GitHub token is invalid or expired. Enter a new token.","error");}
      else status(e.status===409?"GitHub changed; reload before saving again.":`Sync failed: ${e.message}`,"error");
    }finally{busy=false;}
  };
  const scheduleSave=()=>{clearTimeout(timer);status("Syncing...","busy");timer=setTimeout(saveRemote,1200);};
  const loadRemote = async () => {
    if(!token()){remoteReady=true;status("Not connected — enter a GitHub token to sync.");return;}
    remoteReady=false;status("Loading from GitHub…","busy");
    try{
      const remote=await getRemote(); localStorage.setItem(SHA_KEY,remote.sha); updateLastSyncedUI(remote.updatedAt);
      const local=state();
      if(Object.keys(remote.state).length===0&&Object.keys(local).length){remoteReady=true;await saveRemote();return;}
      suppressSave=true;localStorage.setItem(STATE_KEY,JSON.stringify(remote.state));suppressSave=false;remoteReady=true;
      status("Synced ✓","ok"); updateProgressBanner();
      window.dispatchEvent(new CustomEvent('jasper:pokedex-state-synced', { detail: { sha: remote.sha } }));
    }catch(e){
      suppressSave=false;remoteReady=true;
      if(e.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);setTokenUI(false);status("GitHub token is invalid or expired.","error");}
      else status(e.status===404?"Save not found; your next change will create it.":`Could not load GitHub save: ${e.message}`,e.status===404?"normal":"error");
    }
  };
  const connect = async () => {
    const input=document.getElementById("githubTokenInput"),value=input?.value.trim(); if(!value)return status("Paste your GitHub token first.","error");
    status("Verifying GitHub token…","busy");localStorage.setItem(TOKEN_KEY,value);
    try{await getRemote();localStorage.removeItem(SHA_KEY);setTokenUI(true);await loadRemote();}
    catch(e){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);setTokenUI(false);status(e.status===401?"GitHub token is invalid or expired.":`Connection failed: ${e.message}`,"error");}
  };

  const pruneRegionalForms=()=>["Kyurem","Keldeo","Meloetta","Genesect"].forEach(base=>{
    const matches=[...document.querySelectorAll(`#boxContainer .cell[data-name^="${base}"]`)].filter(c=>!c.classList.contains("empty")); matches.slice(1).forEach(c=>c.remove());
  });
  const ensureFinalBoxCapacity=()=>{const grids=document.querySelectorAll("#boxContainer .grid"),g=grids[grids.length-1];if(!g)return;const count=[...g.children].filter(e=>!e.classList.contains("empty")&&getComputedStyle(e).display!=="none").length;for(let i=g.children.length;i<30;i++){const e=document.createElement("div");e.className="cell empty";g.appendChild(e);}if(count<30)for(let i=g.children.length;i<30;i++){const e=document.createElement("div");e.className="cell empty";g.appendChild(e);}};
  const updateProgressBanner=()=>{const b=document.getElementById("dexProgressBanner");if(!b)return;const saved=state(),cells=[...document.querySelectorAll("#boxContainer .cell:not(.empty)")],done=cells.filter(c=>!!saved[c.dataset.id]).length,registered=Math.min(TOTAL_DEX,done);b.querySelector(".dex-progress-text").textContent=`${registered} of ${TOTAL_DEX} Pokémon registered · ${TOTAL_DEX-registered} remaining · ${Math.round(registered/TOTAL_DEX*100)}% complete`;};

  const injectStyles=()=>{
    if(document.getElementById("pokedexLayoutStyles"))return;
    const s=document.createElement("style");s.id="pokedexLayoutStyles";s.textContent=`
      :root{--pokedex-header-height:0px}
      html{scroll-padding-top:calc(var(--pokedex-header-height) + 18px)}
      body{padding-top:calc(var(--pokedex-header-height) + 16px)!important}
      #pokedexHeader{position:fixed;top:0;left:0;right:0;z-index:5000;overflow:visible;background:#fff;border-bottom:1px solid #cbd5e1;box-shadow:0 3px 14px rgba(15,23,42,.08)}
      #pokedexHeaderInner{max-width:900px;margin:0 auto;padding:12px 8px 10px;position:relative;overflow:visible}
      #pokedexHeaderTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;overflow:visible}
      #pokedexBrand{min-width:0}#pokedexBrand h1{text-align:left!important;margin:0!important;font-size:1.75rem!important;line-height:1.1}#pokedexBetaMoniker{margin-top:3px;color:#475569;font-size:.9rem;font-weight:600}
      #pokedexControlsArea{margin-top:10px;position:relative;z-index:2}
      #pokedexHeader .tabs-container{justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 0 10px!important;padding-bottom:2px}#pokedexHeader .tabs-container::-webkit-scrollbar{display:none}#pokedexHeader .tab-btn{flex:0 0 auto}
      #pokedexHeader .controls-container{margin:0!important;max-width:none!important}#pokedexHeader .search-wrapper{min-width:0}#pokedexHeader .search-results{z-index:6000}
      #githubSyncWrap{position:relative;flex-shrink:0;z-index:7000}#githubSyncPill{display:flex;align-items:center;gap:7px;border:1px solid #cbd5e1;background:rgba(255,255,255,.96);color:#475569;border-radius:999px;padding:7px 10px;font:600 .82rem inherit;cursor:pointer;box-shadow:0 1px 3px rgba(15,23,42,.08)}
      .github-sync-icon{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid currentColor;line-height:1;flex-shrink:0}.github-sync-icon.spinning{animation:githubSyncSpin 1s linear infinite}@keyframes githubSyncSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      #githubSyncPill[data-state="normal"] .github-sync-icon{color:#dc2626}#githubSyncPill[data-state="ok"] .github-sync-icon{color:#16a34a}#githubSyncPill[data-state="busy"] .github-sync-icon{color:#2563eb;border-color:#2563eb}#githubSyncPill[data-state="warning"] .github-sync-icon{color:#ca8a04;border-color:#ca8a04}
      .github-sync-chevron{width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);transition:transform .18s ease;margin:0 2px 3px 1px}.github-sync-wrap.open .github-sync-chevron{transform:rotate(225deg)}
      #githubSyncMenu{display:none;position:absolute;top:calc(100% + 8px);right:0;z-index:9000;width:min(360px,calc(100vw - 24px));background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:12px;box-shadow:0 16px 36px rgba(15,23,42,.2)}#githubSyncWrap.open #githubSyncMenu{display:block}
      #githubSyncStatus{font-size:.82rem;color:#64748b;margin-bottom:4px}#githubSyncStatus[data-type="ok"]{color:#047857}#githubSyncStatus[data-type="error"]{color:#a16207}#githubSyncStatus[data-type="busy"]{color:#1d4ed8}#githubLastSynced{font-size:.76rem;color:#64748b;margin:0 0 10px}
      #githubSyncControls{display:flex;gap:8px;align-items:center}#githubTokenInput{flex:1;min-width:0;padding:9px 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}#githubTokenInput:disabled{background:#f1f5f9;color:#64748b;cursor:not-allowed}#githubSyncControls button{padding:9px 11px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;font-weight:600;cursor:pointer;white-space:nowrap}
      #dexProgressBanner{display:flex;align-items:center;gap:9px;margin:0 0 18px;padding:10px 12px;border:1px solid #bfdbfe;border-radius:9px;background:#eff6ff;color:#1e40af;font-size:.84rem;font-weight:600}.dex-progress-icon{width:21px;height:21px;border:1.5px solid #60a5fa;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.76rem;font-weight:800}
      .jump-highlight{animation:pokedexJumpGlow 1.8s ease-out both;position:relative;z-index:3;opacity:1!important}@keyframes pokedexJumpGlow{0%,55%{border-color:#2563eb!important;box-shadow:inset 0 0 0 2px #2563eb,0 0 16px 3px rgba(37,99,235,.55)}75%{border-color:#2563eb!important;box-shadow:inset 0 0 0 2px #2563eb,0 0 8px 2px rgba(37,99,235,.28)}100%{border-color:var(--jump-final-border,#e2e8f0)!important;box-shadow:none}}.jump-to-btn{margin-left:auto;border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:6px;padding:5px 8px;font-size:.76rem;font-weight:700;cursor:pointer;flex-shrink:0}
      #searchClearBtn{position:absolute;top:50%;right:8px;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:50%;background:#e2e8f0;color:#475569;display:none;align-items:center;justify-content:center;font-size:16px;font-weight:700;cursor:pointer;padding:0;z-index:3}
      @media(min-width:641px){
        body{padding:0!important;margin:0;overflow:hidden!important;background:#f1f5f9}
        #desktopSidebar{position:fixed;left:0;top:0;bottom:0;width:272px;background:#fff;border-right:1px solid #cbd5e1;padding:28px 20px;z-index:8000;box-shadow:3px 0 14px rgba(15,23,42,.05)}
        #desktopSidebar h1{text-align:left;margin:0;font-size:1.65rem;color:#0f172a;line-height:1.1}.desktop-beta{margin-top:4px;color:#475569;font-size:.9rem;font-weight:600}.desktop-sidebar-separator{height:1px;background:#e2e8f0;margin:24px 0}.desktop-sidebar-subheader{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#64748b;margin-bottom:10px}.desktop-title-tabs{display:flex;flex-direction:column;gap:8px}.desktop-title-tabs .tab-btn{width:100%;text-align:left;padding:10px 12px}.desktop-title-tabs .tab-btn.disabled{opacity:.55}
        #pokedexHeader{left:272px;right:0;height:82px}.desktop-brand-placeholder{font-size:1.15rem;font-weight:700;color:#0f172a;margin-top:2px}.desktop-brand-placeholder small{display:block;color:#64748b;font-size:.78rem;font-weight:600;margin-top:3px}
        #pokedexHeaderInner{max-width:none;padding:18px 28px}.desktop-workspace-title{display:block}.desktop-workspace-title strong{font-size:1.15rem}.desktop-workspace-title span{display:block;color:#64748b;font-size:.78rem;margin-top:3px}.desktop-hide-mobile-brand{display:none!important}#pokedexControlsArea{display:none!important}
        #pokedexHeaderTop{align-items:center}.desktop-main{position:fixed;left:272px;right:0;top:82px;bottom:0;padding:18px 24px 24px;overflow:hidden}.desktop-table{height:100%;display:flex;flex-direction:column;background:#fff;border:1px solid #cbd5e1;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,.05)}.desktop-table-head{padding:14px 16px 0;flex:0 0 auto}.desktop-table-head #dexProgressBanner{margin:0 0 12px}.desktop-table-head .controls-container{max-width:none;margin:0 0 14px;display:flex}.desktop-scroll{min-height:0;flex:1;overflow-y:auto;padding:0 16px 20px}.desktop-scroll #boxContainer{gap:20px}.desktop-scroll .list-container{margin-bottom:20px}
        #desktopGameTitle{display:block!important}.desktop-sidebar-brand{display:block}.desktop-sidebar-brand .beta{margin-top:4px;color:#475569;font-size:.9rem;font-weight:600}
      }
      @media(max-width:640px){#desktopSidebar,#desktopGameTitle,.desktop-main{display:none!important}#pokedexHeaderInner{padding:10px 8px 9px}#pokedexBrand h1{font-size:1.4rem!important}#pokedexBetaMoniker{font-size:.82rem}#pokedexHeader .controls-container{gap:7px}#pokedexHeader .toggle-btn{padding:8px 9px;font-size:.76rem}#pokedexHeader .toggle-btn svg{display:none}#githubSyncMenu{width:min(340px,calc(100vw - 16px));right:-2px}#pokedexHeader .search-results{position:fixed!important;left:0!important;right:0!important;width:100vw!important;max-width:100vw!important;z-index:10000!important}}
    `;document.head.appendChild(s);
  };

  const buildDesktop = () => {
    if(isMobile()||document.getElementById("desktopSidebar"))return;
    const brand=document.getElementById("pokedexBrand"),header=document.getElementById("pokedexHeader"),inner=document.getElementById("pokedexHeaderInner"),main=document.querySelector(".main-content"),controls=document.querySelector(".controls-container"),banner=document.getElementById("dexProgressBanner"),box=document.getElementById("boxContainer"),list=document.getElementById("listContainer"),tabs=document.querySelector(".tabs-container");
    if(!brand||!header||!inner||!main||!controls||!tabs)return;
    const sidebar=document.createElement("aside");sidebar.id="desktopSidebar";sidebar.innerHTML=`<div class="desktop-sidebar-brand"><h1>Jasper's Pokedex</h1><div class="beta">Beta v0.8</div></div><div class="desktop-sidebar-separator"></div><div class="desktop-sidebar-subheader">Titles</div><div class="desktop-title-tabs"></div>`;document.body.appendChild(sidebar);
    sidebar.querySelector(".desktop-title-tabs").appendChild(tabs);
    const sync=document.getElementById("githubSyncWrap"),top= document.getElementById("pokedexHeaderTop");
    brand.innerHTML=`<div class="desktop-workspace-title"><strong>Pokemon White 2</strong><span>Living Regional Dex</span></div>`;
    if(sync)top.appendChild(sync);
    const desktopMain=document.createElement("main");desktopMain.className="desktop-main";const table=document.createElement("div");table.className="desktop-table";const head=document.createElement("div");head.className="desktop-table-head";if(banner)head.appendChild(banner);head.appendChild(controls);const scroll=document.createElement("div");scroll.className="desktop-scroll";if(box)scroll.appendChild(box);if(list)scroll.appendChild(list);table.append(head,scroll);desktopMain.appendChild(table);document.body.appendChild(desktopMain);
    document.documentElement.style.setProperty("--pokedex-header-height","82px");
  };
  const buildMobileHeader = () => {
    if(!isMobile()&&!document.getElementById("pokedexHeader"))return;
    const h1=document.querySelector("body>h1"),tabs=document.querySelector("body>.tabs-container"),controls=document.querySelector("body>.controls-container"); if(!h1||!tabs||!controls)return;
    if(document.getElementById("pokedexHeader"))return;
    const header=document.createElement("header");header.id="pokedexHeader";const inner=document.createElement("div");inner.id="pokedexHeaderInner";const top=document.createElement("div");top.id="pokedexHeaderTop";const brand=document.createElement("div");brand.id="pokedexBrand";h1.parentNode.insertBefore(header,h1);brand.appendChild(h1);const beta=document.createElement("div");beta.id="pokedexBetaMoniker";beta.textContent="Beta v0.8";brand.appendChild(beta);const sync=document.createElement("div");sync.id="githubSyncWrap";sync.innerHTML=`<button id="githubSyncPill" type="button" data-state="normal" aria-expanded="false"><span id="githubSyncIcon" class="github-sync-icon">×</span><span class="github-sync-label">Token Sync</span><span class="github-sync-chevron" aria-hidden="true"></span></button><div id="githubSyncMenu" role="menu"><div id="githubSyncStatus">Not connected — enter a GitHub token to sync.</div><div id="githubLastSynced"></div><div id="githubSyncControls"><input id="githubTokenInput" type="password" autocomplete="off" placeholder="GitHub token"><button id="githubConnectBtn" type="button">Activate Token</button><button id="githubChangeTokenBtn" type="button" hidden>Change Token</button></div><p id="githubSyncNote">Your token stays in this browser and is never committed to GitHub.</p></div>`;top.append(brand,sync);inner.appendChild(top);const area=document.createElement("div");area.id="pokedexControlsArea";area.append(tabs,controls);inner.appendChild(area);header.appendChild(inner);document.body.insertBefore(header,document.body.firstElementChild);
    const wrapper=document.getElementById("searchInput")?.closest(".search-wrapper"),input=document.getElementById("searchInput");if(wrapper&&input){const clear=document.createElement("button");clear.id="searchClearBtn";clear.type="button";clear.textContent="×";clear.setAttribute("aria-label","Clear search");wrapper.appendChild(clear);const update=()=>clear.style.display=input.value?"flex":"none";clear.onclick=()=>{input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();update()};input.addEventListener("input",update);update();}
    const main=document.querySelector(".main-content"),box=document.getElementById("boxContainer");if(main&&box&&!document.getElementById("dexProgressBanner")){const b=document.createElement("div");b.id="dexProgressBanner";b.innerHTML=`<span class="dex-progress-icon">i</span><span class="dex-progress-text"></span>`;main.insertBefore(b,box);}
    const updateHeight=()=>document.documentElement.style.setProperty("--pokedex-header-height",`${header.offsetHeight}px`);requestAnimationFrame(updateHeight);addEventListener("resize",updateHeight);
    document.getElementById("githubSyncPill").onclick=()=>{const wrap=document.getElementById("githubSyncWrap"),open=wrap.classList.toggle("open");document.getElementById("githubSyncPill").setAttribute("aria-expanded",String(open));updateLastSyncedUI()};document.addEventListener("click",e=>{const wrap=document.getElementById("githubSyncWrap");if(wrap&&!wrap.contains(e.target))wrap.classList.remove("open")});document.getElementById("githubConnectBtn").onclick=connect;document.getElementById("githubChangeTokenBtn").onclick=()=>{clearTimeout(timer);localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);remoteReady=false;setTokenUI(false);status("Enter a new GitHub token to activate sync.")};if(token())setTokenUI(true);updateLastSyncedUI();
  };
  const findTarget=result=>{const id=result.dataset.id,active=document.getElementById("listViewBtn")?.classList.contains("active"),selector=active?".list-row":".cell:not(.empty)";if(id){const t=document.querySelector(`${selector}[data-id="${CSS.escape(id)}"]`);if(t)return t;}const text=(result.dataset.name||result.querySelector(".name")?.textContent||result.textContent||"").replace(/Jump to/gi,"").trim().toLowerCase();return [...document.querySelectorAll(selector)].find(e=>(e.dataset.name||e.querySelector(".name")?.textContent||"").toLowerCase()===text);};
  const jumpTo=result=>{const target=findTarget(result);if(!target)return;const final=target.classList.contains("completed")?"#a7f3d0":"#e2e8f0";target.style.setProperty("--jump-final-border",final);target.classList.remove("jump-highlight");void target.offsetWidth;target.classList.add("jump-highlight");target.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>target.classList.remove("jump-highlight"),1900);};
  const observeSearch=()=>{const r=document.getElementById("searchResults");if(!r)return;const add=()=>r.querySelectorAll(".search-result-item").forEach(item=>{if(item.querySelector(".jump-to-btn"))return;const b=document.createElement("button");b.type="button";b.className="jump-to-btn";b.textContent="Jump to";b.onclick=e=>{e.preventDefault();e.stopPropagation();jumpTo(item)};item.appendChild(b);});new MutationObserver(add).observe(r,{childList:true,subtree:true});add();};

  const start=()=>{
    injectStyles();pruneRegionalForms();ensureFinalBoxCapacity();
    if(isMobile())buildMobileHeader();else{buildMobileHeader();buildDesktop();}
    if(token())loadRemote();else{remoteReady=true;setPillState("normal");}
    observeSearch();updateProgressBanner();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
