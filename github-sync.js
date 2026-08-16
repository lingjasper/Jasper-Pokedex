/* GitHub-only cross-device save sync for Jasper's Pokedex.
   The token is entered by the owner and stored only in this browser's localStorage.
   It is never written to the repository.
*/
(() => {
  const STATE_KEY = "b2w2_living_dex_saved_state";
  const TOKEN_KEY = "jasper_pokedex_github_token";
  const SHA_KEY = "jasper_pokedex_save_sha";
  const REPO_OWNER = "lingjasper";
  const REPO_NAME = "Jasper-Pokedex";
  const SAVE_PATH = "save.json";
  const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  let saveTimer = null;
  let syncing = false;
  let remoteInitialized = false;

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && key === STATE_KEY && remoteInitialized) {
      scheduleSave();
    }
  };

  const token = () => localStorage.getItem(TOKEN_KEY) || "";
  const localState = () => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); }
    catch { return {}; }
  };

  const setStatus = (text, type = "normal") => {
    const el = document.getElementById("githubSyncStatus");
    if (!el) return;
    el.textContent = text;
    el.dataset.type = type;
  };

  const bytesToBase64 = bytes => {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  const base64ToText = base64 => {
    const binary = atob(base64.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };

  const jsonToBase64 = value =>
    bytesToBase64(new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n"));

  const api = async (path, options = {}) => {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      ...options.headers
    };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body.message || `GitHub API error ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return body;
  };

  const getRemoteSave = async () => {
    const file = await api(`/contents/${SAVE_PATH}?ref=main`);
    const parsed = JSON.parse(base64ToText(file.content));
    return { state: parsed.pokemon || {}, sha: file.sha };
  };

  const saveRemote = async () => {
    if (!token() || syncing) return;
    syncing = true;
    setStatus("Saving to GitHub…", "busy");
    try {
      let sha = localStorage.getItem(SHA_KEY);
      if (!sha) {
        try {
          const current = await getRemoteSave();
          sha = current.sha;
        } catch (error) {
          if (error.status !== 404) throw error;
        }
      }

      const payload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        pokemon: localState()
      };

      const body = {
        message: "Update Pokedex progress",
        content: jsonToBase64(payload),
        branch: "main"
      };
      if (sha) body.sha = sha;

      const result = await api(`/contents/${SAVE_PATH}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const newSha = result.content && result.content.sha;
      if (newSha) localStorage.setItem(SHA_KEY, newSha);
      setStatus("Synced ✓", "ok");
    } catch (error) {
      if (error.status === 401) {
        setStatus("GitHub token is invalid or expired.", "error");
      } else if (error.status === 409) {
        setStatus("GitHub changed; try Sync Now again.", "error");
      } else {
        setStatus(`Sync failed: ${error.message}`, "error");
      }
    } finally {
      syncing = false;
    }
  };

  const scheduleSave = () => {
    clearTimeout(saveTimer);
    setStatus("Unsaved changes…", "busy");
    saveTimer = setTimeout(saveRemote, 1200);
  };

  const loadRemote = async () => {
    if (!token()) {
      remoteInitialized = true;
      setStatus("Local only — add your GitHub token to sync.");
      return;
    }

    setStatus("Checking GitHub…", "busy");
    try {
      const remote = await getRemoteSave();
      localStorage.setItem(SHA_KEY, remote.sha);
      const local = localState();
      const remoteKeys = Object.keys(remote.state);
      const localKeys = Object.keys(local);

      if (remoteKeys.length === 0 && localKeys.length > 0) {
        remoteInitialized = true;
        await saveRemote();
        return;
      }

      localStorage.setItem(STATE_KEY, JSON.stringify(remote.state));
      remoteInitialized = true;
      setStatus(`Synced ✓ (${remoteKeys.filter(k => remote.state[k]).length} completed)`, "ok");
      setTimeout(() => location.reload(), 50);
    } catch (error) {
      remoteInitialized = true;
      if (error.status === 401) {
        setStatus("GitHub token is invalid or expired.", "error");
      } else if (error.status === 404) {
        setStatus("save.json not found; your next change will create it.", "normal");
      } else {
        setStatus(`Could not load GitHub save: ${error.message}`, "error");
      }
    }
  };

  const disconnect = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SHA_KEY);
    setStatus("GitHub sync disconnected.");
    const input = document.getElementById("githubTokenInput");
    if (input) input.value = "";
  };

  const connect = async () => {
    const input = document.getElementById("githubTokenInput");
    const value = input.value.trim();
    if (!value) {
      setStatus("Paste your fine-grained GitHub token first.", "error");
      return;
    }

    setStatus("Verifying token…", "busy");
    try {
      localStorage.setItem(TOKEN_KEY, value);
      await api("/../user");
      await getRemoteSave();
      localStorage.removeItem(SHA_KEY);
      setStatus("Connected. Loading your GitHub save…", "ok");
      await loadRemote();
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SHA_KEY);
      setStatus(`Connection failed: ${error.message}`, "error");
    }
  };

  const injectUI = () => {
    if (document.getElementById("githubSyncPanel")) return;
    const style = document.createElement("style");
    style.textContent = `
      #githubSyncPanel { max-width:900px; margin:0 auto 20px; padding:12px 14px; background:#fff; border:2px solid #cbd5e1; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,.05); }
      #githubSyncPanel summary { cursor:pointer; font-weight:700; color:#1e3a8a; }
      #githubSyncControls { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:10px; }
      #githubTokenInput { flex:1; min-width:240px; padding:9px 10px; border:1px solid #cbd5e1; border-radius:7px; font:inherit; }
      #githubSyncControls button { padding:9px 12px; border:1px solid #cbd5e1; border-radius:7px; background:#f8fafc; font-weight:600; cursor:pointer; }
      #githubSyncStatus { margin-top:8px; font-size:.82rem; color:#64748b; }
      #githubSyncStatus[data-type="ok"] { color:#047857; }
      #githubSyncStatus[data-type="error"] { color:#b91c1c; }
      #githubSyncStatus[data-type="busy"] { color:#1d4ed8; }
      #githubSyncNote { margin:8px 0 0; font-size:.76rem; color:#64748b; line-height:1.4; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("details");
    panel.id = "githubSyncPanel";
    panel.innerHTML = `
      <summary>GitHub Sync</summary>
      <div id="githubSyncControls">
        <input id="githubTokenInput" type="password" autocomplete="off" placeholder="Fine-grained GitHub token">
        <button id="githubConnectBtn" type="button">Connect</button>
        <button id="githubSyncBtn" type="button">Sync Now</button>
        <button id="githubDisconnectBtn" type="button">Disconnect</button>
      </div>
      <div id="githubSyncStatus">Local only — add your GitHub token to sync.</div>
      <p id="githubSyncNote">For this personal setup, the token is stored only in this browser. It is never committed to GitHub. Use a fine-grained token limited to this repository with Contents: Read and write.</p>
    `;
    const heading = document.querySelector("h1");
    heading.parentNode.insertBefore(panel, heading.nextSibling);

    document.getElementById("githubConnectBtn").addEventListener("click", connect);
    document.getElementById("githubSyncBtn").addEventListener("click", async () => {
      if (!token()) return setStatus("Connect GitHub first.", "error");
      try {
        const remote = await getRemoteSave();
        localStorage.setItem(SHA_KEY, remote.sha);
        remoteInitialized = true;
        await saveRemote();
      } catch (error) {
        setStatus(`Sync failed: ${error.message}`, "error");
      }
    });
    document.getElementById("githubDisconnectBtn").addEventListener("click", disconnect);
  };

  document.addEventListener("DOMContentLoaded", () => {
    injectUI();
    if (token()) {
      document.getElementById("githubTokenInput").value = "";
      loadRemote();
    } else {
      remoteInitialized = true;
    }
  });
})();
