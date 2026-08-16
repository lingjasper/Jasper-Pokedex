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

  const setPillState = (type) => {
    const pill = document.getElementById("githubSyncPill");
    const icon = document.getElementById("githubSyncIcon");
    if (!pill || !icon) return;
    pill.dataset.state = type;
    icon.className = "github-sync-icon " + (type === "busy" ? "spinning" : "");
    icon.textContent = type === "ok" ? "✓" : type === "busy" ? "↻" : type === "warning" ? "!" : "×";
    icon.setAttribute("aria-label", type === "ok" ? "Synced" : type === "busy" ? "Syncing" : type === "warning" ? "Sync warning" : "Not connected");
  };

  const status = (text, type = "normal") => {
    const el = document.getElementById("githubSyncStatus");
    if (el) { el.textContent = text; el.dataset.type = type; }
    setPillState(type === "ok" ? "ok" : type === "busy" ? "busy" : type === "error" ? "warning" : token() ? "ok" : "normal");
  };

  const setTokenUI = (active) => {
    const input = document.getElementById("githubTokenInput");
    const activate = document.getElementById("githubConnectBtn");
    const change = document.getElementById("githubChangeTokenBtn");
    if (!input) return;
    if (active) {
      input.type = "text";
      input.value = "****************";
      input.disabled = true;
      if (activate) activate.hidden = true;
      if (change) change.hidden = false;
    } else {
      input.type = "password";
      input.value = "";
      input.disabled = false;
      if (activate) activate.hidden = false;
      if (change) change.hidden = true;
    }
  };

  const b64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const text64 = text => b64(new TextEncoder().encode(text));
  const from64 = value => { const b = atob(value.replace(/\n/g, "")); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); };

  const request = async (url, options = {}) => {
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const r = await fetch(url, { ...options, headers });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(body.message || `GitHub API error ${r.status}`); e.status = r.status; throw e; }
    return body;
  };

  const getRemote = async () => {
    const file = await request(`${API}${SAVE}`);
    const data = JSON.parse(from64(file.content));
    return { state: data.pokemon || {}, sha: file.sha };
  };

  const saveRemote = async () => {
    if (!token() || busy) return;
    busy = true;
    status("Saving to GitHub…", "busy");
    try {
      let sha = localStorage.getItem(SHA_KEY);
      if (!sha) {
        try { sha = (await getRemote()).sha; } catch (e) { if (e.status !== 404) throw e; }
      }
      const payload = { version: 1, updatedAt: new Date().toISOString(), pokemon: state() };
      const body = { message: "Update Pokedex progress", content: text64(JSON.stringify(payload, null, 2) + "\n"), branch: "main" };
      if (sha) body.sha = sha;
      const result = await request(`${API}/contents/save.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (result.content?.sha) localStorage.setItem(SHA_KEY, result.content.sha);
      status("Synced ✓", "ok");
    } catch (e) {
      if (e.status === 401) {
        localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SHA_KEY); setTokenUI(false);
        status("GitHub token is invalid or expired. Enter a new token.", "error");
      } else {
        status(e.status === 409 ? "GitHub changed; reload before saving again." : `Sync failed: ${e.message}`, "error");
      }
    } finally { busy = false; }
  };

  const scheduleSave = () => {
    clearTimeout(timer);
    status("Unsaved changes…", "busy");
    timer = setTimeout(saveRemote, 1200);
  };

  const loadRemote = async () => {
    if (!token()) {
      remoteReady = true;
      status("Not connected — enter a GitHub token to sync.", "normal");
      return;
    }
    remoteReady = false;
    status("Loading from GitHub…", "busy");
    try {
      const remote = await getRemote();
      localStorage.setItem(SHA_KEY, remote.sha);
      const local = state(), remoteKeys = Object.keys(remote.state), localKeys = Object.keys(local);
      if (remoteKeys.length === 0 && localKeys.length) { remoteReady = true; await saveRemote(); return; }
      suppressSave = true;
      localStorage.setItem(STATE_KEY, JSON.stringify(remote.state));
      suppressSave = false;
      remoteReady = true;
      status(`Synced ✓ (${remoteKeys.filter(k => remote.state[k]).length} completed)`, "ok");
      if (sessionStorage.getItem(RELOAD_KEY) !== remote.sha) {
        sessionStorage.setItem(RELOAD_KEY, remote.sha);
        setTimeout(() => location.reload(), 50);
      } else sessionStorage.removeItem(RELOAD_KEY);
    } catch (e) {
      suppressSave = false; remoteReady = true;
      if (e.status === 401) {
        localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SHA_KEY); setTokenUI(false);
        status("GitHub token is invalid or expired. Enter a new token.", "error");
      } else {
        status(e.status === 404 ? "Save not found; your next change will create it." : `Could not load GitHub save: ${e.message}`, e.status === 404 ? "normal" : "error");
      }
    }
  };

  const connect = async () => {
    const input = document.getElementById("githubTokenInput"), value = input?.value.trim();
    if (!value) return status("Paste your GitHub token first.", "error");
    status("Verifying GitHub token…", "busy");
    localStorage.setItem(TOKEN_KEY, value);
    try {
      await getRemote();
      localStorage.removeItem(SHA_KEY);
      setTokenUI(true);
      await loadRemote();
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SHA_KEY); setTokenUI(false);
      status(e.status === 401 ? "GitHub token is invalid or expired." : `Connection failed: ${e.message}`, "error");
    }
  };

  const injectHeader = () => {
    if (document.getElementById("pokedexHeader")) return;
    const style = document.createElement("style");
    style.textContent = `
      :root { --pokedex-header-height: 0px; --pokedex-banner: none; }
      body { padding-top: calc(var(--pokedex-header-height) + 16px) !important; }
      #pokedexHeader { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #ffffff; background-image: var(--pokedex-banner); background-size: cover; background-position: center; border-bottom: 1px solid #cbd5e1; box-shadow: 0 3px 14px rgba(15,23,42,.08); }
      #pokedexHeaderInner { max-width: 900px; margin: 0 auto; padding: 12px 8px 10px; position: relative; }
      #pokedexHeaderTop { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      #pokedexBrand { min-width:0; }
      #pokedexBrand h1 { text-align:left !important; margin:0 !important; font-size:1.75rem !important; line-height:1.1; }
      #pokedexBetaMoniker { margin-top:3px; color:#475569; font-size:.9rem; font-weight:600; }
      #pokedexControlsArea { margin-top:10px; }
      #pokedexHeader .tabs-container { justify-content:flex-start; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; margin:0 0 10px !important; padding-bottom:2px; }
      #pokedexHeader .tabs-container::-webkit-scrollbar { display:none; }
      #pokedexHeader .tab-btn { flex:0 0 auto; }
      #pokedexHeader .controls-container { margin:0 !important; max-width:none !important; }
      #pokedexHeader .search-results { z-index:1100; }
      #pokedexHeader .view-toggle { flex-shrink:0; }
      #githubSyncWrap { position:relative; flex-shrink:0; }
      #githubSyncPill { display:flex; align-items:center; gap:7px; border:1px solid #cbd5e1; background:rgba(255,255,255,.94); color:#475569; border-radius:999px; padding:7px 10px; font:600 .82rem inherit; cursor:pointer; box-shadow:0 1px 3px rgba(15,23,42,.08); }
      #githubSyncPill:hover { background:#fff; }
      .github-sync-icon { width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; border:2px solid currentColor; line-height:1; }
      #githubSyncPill[data-state="normal"] .github-sync-icon { color:#dc2626; }
      #githubSyncPill[data-state="ok"] .github-sync-icon { color:#16a34a; }
      #githubSyncPill[data-state="busy"] .github-sync-icon { color:#2563eb; border-color:#2563eb; }
      #githubSyncPill[data-state="warning"] .github-sync-icon { color:#ca8a04; border-color:#ca8a04; }
      .github-sync-icon.spinning { animation: githubSyncSpin 1s linear infinite; }
      @keyframes githubSyncSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      #githubSyncMenu { display:none; position:absolute; top:calc(100% + 8px); right:0; width:min(360px, calc(100vw - 24px)); background:#fff; border:1px solid #cbd5e1; border-radius:12px; padding:12px; box-shadow:0 12px 30px rgba(15,23,42,.15); }
      #githubSyncWrap.open #githubSyncMenu { display:block; }
      #githubSyncStatus { font-size:.82rem; color:#64748b; margin-bottom:10px; }
      #githubSyncStatus[data-type="ok"] { color:#047857; } #githubSyncStatus[data-type="error"] { color:#a16207; } #githubSyncStatus[data-type="busy"] { color:#1d4ed8; }
      #githubSyncControls { display:flex; gap:8px; align-items:center; }
      #githubTokenInput { flex:1; min-width:0; padding:9px 10px; border:1px solid #cbd5e1; border-radius:7px; font:inherit; }
      #githubTokenInput:disabled { background:#f1f5f9; color:#64748b; cursor:not-allowed; }
      #githubSyncControls button { padding:9px 11px; border:1px solid #cbd5e1; border-radius:7px; background:#f8fafc; font-weight:600; cursor:pointer; white-space:nowrap; }
      #githubSyncNote { margin:9px 0 0; font-size:.74rem; color:#64748b; line-height:1.35; }
      .jump-highlight { animation: pokedexJumpGlow 1.8s ease-out; position:relative; z-index:3; }
      @keyframes pokedexJumpGlow { 0%,35% { box-shadow:0 0 0 3px rgba(37,99,235,.85), 0 0 22px 5px rgba(37,99,235,.55); border-color:#2563eb !important; } 100% { box-shadow:none; } }
      .jump-to-btn { margin-left:auto; border:1px solid #93c5fd; background:#eff6ff; color:#1d4ed8; border-radius:6px; padding:5px 8px; font-size:.76rem; font-weight:700; cursor:pointer; flex-shrink:0; }
      .jump-to-btn:hover { background:#dbeafe; }
      @media (max-width: 640px) {
        #pokedexHeaderInner { padding:10px 8px 9px; }
        #pokedexBrand h1 { font-size:1.4rem !important; }
        #pokedexBetaMoniker { font-size:.9rem; }
        #pokedexHeader .controls-container { gap:7px; }
        #pokedexHeader .search-input { padding:9px 10px; }
        #pokedexHeader .toggle-btn { padding:8px 9px; }
        #pokedexHeader .toggle-btn svg { display:none; }
        #pokedexHeader .toggle-btn { font-size:.76rem; }
        #githubSyncPill .github-sync-label { display:none; }
      }
    `;
    document.head.appendChild(style);

    const h1 = document.querySelector("h1");
    const tabs = document.querySelector(".tabs-container");
    const controls = document.querySelector(".controls-container");
    if (!h1 || !tabs || !controls) return;

    const header = document.createElement("header");
    header.id = "pokedexHeader";
    const inner = document.createElement("div");
    inner.id = "pokedexHeaderInner";
    const top = document.createElement("div");
    top.id = "pokedexHeaderTop";
    const brand = document.createElement("div");
    brand.id = "pokedexBrand";
    h1.parentNode.insertBefore(header, h1);
    brand.appendChild(h1);
    const beta = document.createElement("div");
    beta.id = "pokedexBetaMoniker";
    beta.textContent = "Beta v0.5";
    brand.appendChild(beta);

    const syncWrap = document.createElement("div");
    syncWrap.id = "githubSyncWrap";
    syncWrap.innerHTML = `<button id="githubSyncPill" type="button" data-state="normal" aria-expanded="false"><span id="githubSyncIcon" class="github-sync-icon">×</span><span class="github-sync-label">GitHub Sync</span><span aria-hidden="true">⌄</span></button><div id="githubSyncMenu" role="menu"><div id="githubSyncStatus">Not connected — enter a GitHub token to sync.</div><div id="githubSyncControls"><input id="githubTokenInput" type="password" autocomplete="off" placeholder="GitHub token"><button id="githubConnectBtn" type="button">Activate Token</button><button id="githubChangeTokenBtn" type="button" hidden>Change Token</button></div><p id="githubSyncNote">Your token stays in this browser and is never committed to GitHub.</p></div>`;
    top.appendChild(brand); top.appendChild(syncWrap);
    inner.appendChild(top);
    const controlsArea = document.createElement("div");
    controlsArea.id = "pokedexControlsArea";
    controlsArea.appendChild(tabs); controlsArea.appendChild(controls); inner.appendChild(controlsArea);
    header.appendChild(inner);
    document.body.insertBefore(header, document.body.firstElementChild);

    const updateHeight = () => document.documentElement.style.setProperty("--pokedex-header-height", `${header.offsetHeight}px`);
    requestAnimationFrame(updateHeight); window.addEventListener("resize", updateHeight);

    document.getElementById("githubSyncPill").addEventListener("click", () => {
      const open = syncWrap.classList.toggle("open");
      document.getElementById("githubSyncPill").setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", e => { if (!syncWrap.contains(e.target)) syncWrap.classList.remove("open"); });
    document.getElementById("githubConnectBtn").onclick = connect;
    document.getElementById("githubChangeTokenBtn").onclick = () => {
      clearTimeout(timer); localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SHA_KEY); remoteReady = false; setTokenUI(false); status("Enter a new GitHub token to activate sync.", "normal");
    };
    if (token()) setTokenUI(true);
    updateHeight();
  };

  const normalizeLivingDexForms = () => {
    const bases = ["kyurem", "keldeo", "meloetta"];
    [".cell", ".list-row"].forEach(selector => {
      const elements = [...document.querySelectorAll(selector)];
      bases.forEach(base => {
        let kept = false;
        elements.forEach(el => {
          const name = (el.dataset?.name || el.querySelector?.(".name")?.textContent || el.textContent || "").trim().toLowerCase();
          if (!name.includes(base)) return;
          if (!kept) {
            kept = true;
            el.style.display = "";
            el.dataset.betaHiddenForm = "false";
          } else {
            el.dataset.betaHiddenForm = "true";
            el.style.display = "none";
          }
        });
      });
    });
  };

  const findTarget = (result) => {
    const id = result.dataset.id || result.getAttribute("data-id");
    if (id) {
      const byId = document.querySelector(`.cell[data-id="${CSS.escape(id)}"], .list-row[data-id="${CSS.escape(id)}"]`);
      if (byId) return byId;
    }
    const text = result.dataset.name || result.querySelector(".name")?.textContent || result.textContent || "";
    const clean = text.replace(/Jump to/gi, "").trim();
    return [...document.querySelectorAll(".cell, .list-row")].find(el => {
      const name = el.dataset.name || el.querySelector(".name")?.textContent || "";
      return name && (clean.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(clean.toLowerCase()));
    });
  };

  const jumpTo = (result) => {
    const target = findTarget(result);
    if (!target) return;
    const box = target.closest(".pc-box");
    if (box) box.style.display = "block";
    target.style.display = "flex";
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("jump-highlight");
    void target.offsetWidth;
    target.classList.add("jump-highlight");
    setTimeout(() => target.classList.remove("jump-highlight"), 1900);
  };

  const addJumpButtons = () => {
    const results = document.getElementById("searchResults");
    if (!results) return;
    results.querySelectorAll(".search-result-item").forEach(item => {
      if (item.querySelector(".jump-to-btn")) return;
      const button = document.createElement("button");
      button.type = "button"; button.className = "jump-to-btn"; button.textContent = "Jump to";
      button.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); jumpTo(item); });
      item.appendChild(button);
    });
  };

  const observeSearchResults = () => {
    const results = document.getElementById("searchResults");
    if (!results) return;
    new MutationObserver(addJumpButtons).observe(results, { childList: true, subtree: true });
    addJumpButtons();
  };

  document.addEventListener("DOMContentLoaded", () => {
    injectHeader();
    normalizeLivingDexForms();
    const dexObserver = document.querySelector(".main-content");
    if (dexObserver) new MutationObserver(normalizeLivingDexForms).observe(dexObserver, { childList: true, subtree: true });
    observeSearchResults();
    if (token()) loadRemote(); else { remoteReady = true; setPillState("normal"); }
  });
})();
