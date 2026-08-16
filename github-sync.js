(() => {
  const STATE_KEY = "b2w2_living_dex_saved_state";
  const TOKEN_KEY = "jasper_pokedex_github_token";
  const SHA_KEY = "jasper_pokedex_save_sha";
  const RELOAD_KEY = "jasper_pokedex_remote_reload_sha";
  const API = "https://api.github.com/repos/lingjasper/Jasper-Pokedex";
  const SAVE = "/contents/save.json?ref=main";
  let remoteReady = false, timer = null, busy = false, suppressSave = false;

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && key === STATE_KEY && remoteReady && !suppressSave) scheduleSave();
  };
  const token = () => localStorage.getItem(TOKEN_KEY) || "";
  const state = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch { return {}; } };
  const status = (text, type = "normal") => { const el=document.getElementById("githubSyncStatus"); if(el){el.textContent=text;el.dataset.type=type;} };
  const b64 = bytes => { let s=""; for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(s); };
  const text64 = text => b64(new TextEncoder().encode(text));
  const from64 = value => { const b=atob(value.replace(/\n/g,"")); return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0))); };
  const request = async (url, options={}) => {
    const headers={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10",...(options.headers||{})};
    if(token()) headers.Authorization=`Bearer ${token()}`;
    const r=await fetch(url,{...options,headers}); const body=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(body.message||`GitHub API error ${r.status}`);e.status=r.status;throw e;} return body;
  };
  const getRemote = async () => { const file=await request(`${API}${SAVE}`); const data=JSON.parse(from64(file.content)); return {state:data.pokemon||{},sha:file.sha}; };
  const saveRemote = async () => {
    if(!token()||busy)return; busy=true; status("Saving to GitHub…","busy");
    try{
      let sha=localStorage.getItem(SHA_KEY);
      if(!sha){try{sha=(await getRemote()).sha;}catch(e){if(e.status!==404)throw e;}}
      const payload={version:1,updatedAt:new Date().toISOString(),pokemon:state()};
      const body={message:"Update Pokedex progress",content:text64(JSON.stringify(payload,null,2)+"\n"),branch:"main"}; if(sha)body.sha=sha;
      const result=await request(`${API}/contents/save.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(result.content?.sha)localStorage.setItem(SHA_KEY,result.content.sha); status("Synced ✓","ok");
    }catch(e){status(e.status===401?"GitHub token is invalid or expired.":e.status===409?"GitHub changed; click Sync Now again.":`Sync failed: ${e.message}`,"error");}finally{busy=false;}
  };
  const scheduleSave=()=>{clearTimeout(timer);status("Unsaved changes…","busy");timer=setTimeout(saveRemote,1200);};
  const loadRemote = async () => {
    if(!token()){remoteReady=true;status("Local only — connect GitHub to sync.");return;}
    remoteReady=false; status("Checking GitHub…","busy");
    try{
      const remote=await getRemote(); localStorage.setItem(SHA_KEY,remote.sha);
      const local=state(), remoteKeys=Object.keys(remote.state), localKeys=Object.keys(local);
      if(remoteKeys.length===0&&localKeys.length){remoteReady=true;await saveRemote();return;}
      // Apply the downloaded save without triggering the autosave watcher.
      suppressSave=true;
      localStorage.setItem(STATE_KEY,JSON.stringify(remote.state));
      suppressSave=false;
      remoteReady=true;
      status(`Synced ✓ (${remoteKeys.filter(k=>remote.state[k]).length} completed)`,"ok");
      // The main Pokedex reads localStorage at startup. Reload once so its UI uses
      // the downloaded save, but remember the SHA so this cannot become a reload loop.
      if(sessionStorage.getItem(RELOAD_KEY)!==remote.sha){
        sessionStorage.setItem(RELOAD_KEY,remote.sha);
        setTimeout(()=>location.reload(),50);
      }else{
        sessionStorage.removeItem(RELOAD_KEY);
      }
    }catch(e){
      suppressSave=false; remoteReady=true;
      status(e.status===404?"save.json not found; your next change will create it.":e.status===401?"GitHub token is invalid or expired.":`Could not load GitHub save: ${e.message}`,e.status===401?"error":"normal");
    }
  };
  const connect = async () => {
    const input=document.getElementById("githubTokenInput"), value=input.value.trim(); if(!value)return status("Paste your fine-grained GitHub token first.","error");
    status("Verifying token…","busy"); localStorage.setItem(TOKEN_KEY,value);
    try{await getRemote();localStorage.removeItem(SHA_KEY);await loadRemote();}
    catch(e){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);status(e.status===401?"GitHub token is invalid or expired.":`Connection failed: ${e.message}`,"error");}
  };
  const injectUI=()=>{
    if(document.getElementById("githubSyncPanel"))return;
    const style=document.createElement("style"); style.textContent=`#githubSyncPanel{max-width:900px;margin:0 auto 20px;padding:12px 14px;background:#fff;border:2px solid #cbd5e1;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,.05)}#githubSyncPanel summary{cursor:pointer;font-weight:700;color:#1e3a8a}#githubSyncControls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}#githubTokenInput{flex:1;min-width:240px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}#githubSyncControls button{padding:9px 12px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;font-weight:600;cursor:pointer}#githubSyncStatus{margin-top:8px;font-size:.82rem;color:#64748b}#githubSyncStatus[data-type=ok]{color:#047857}#githubSyncStatus[data-type=error]{color:#b91c1c}#githubSyncStatus[data-type=busy]{color:#1d4ed8}#githubSyncNote{margin:8px 0 0;font-size:.76rem;color:#64748b;line-height:1.4}`; document.head.appendChild(style);
    const panel=document.createElement("details"); panel.id="githubSyncPanel"; panel.innerHTML=`<summary>GitHub Sync</summary><div id="githubSyncControls"><input id="githubTokenInput" type="password" autocomplete="off" placeholder="Fine-grained GitHub token"><button id="githubConnectBtn" type="button">Connect</button><button id="githubSyncBtn" type="button">Sync Now</button><button id="githubDisconnectBtn" type="button">Disconnect</button></div><div id="githubSyncStatus">Local only — connect GitHub to sync.</div><p id="githubSyncNote">Your token is stored only in this browser and is never committed to GitHub. Use a fine-grained token limited to this repository with Contents: Read and write.</p>`;
    const heading=document.querySelector("h1"); heading.parentNode.insertBefore(panel,heading.nextSibling);
    document.getElementById("githubConnectBtn").onclick=connect;
    document.getElementById("githubSyncBtn").onclick=async()=>{if(!token())return status("Connect GitHub first.","error");if(busy)return;try{const r=await getRemote();localStorage.setItem(SHA_KEY,r.sha);remoteReady=true;await saveRemote();}catch(e){status(`Sync failed: ${e.message}`,"error");}};
    document.getElementById("githubDisconnectBtn").onclick=()=>{clearTimeout(timer);localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SHA_KEY);sessionStorage.removeItem(RELOAD_KEY);remoteReady=false;status("GitHub sync disconnected.");};
  };
  document.addEventListener("DOMContentLoaded",()=>{injectUI();if(token())loadRemote();else remoteReady=true;});
})();
