document.addEventListener("DOMContentLoaded", async () => {
  const STORAGE_KEY = "b2w2_living_dex_saved_state";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  let supabase = null;
  let currentUser = null;

  // Load Supabase configuration without breaking the existing local version.
  const configScript = document.createElement("script");
  configScript.src = "supabase.js";
  configScript.onload = async () => {
    const config = window.SUPABASE_CONFIG;
    if (!config || config.url.startsWith("YOUR_") || config.anonKey.startsWith("YOUR_")) {
      initializeLocalStorage();
      return;
    }

    const clientScript = document.createElement("script");
    clientScript.src = SUPABASE_CDN;
    clientScript.onload = async () => {
      supabase = window.supabase.createClient(config.url, config.anonKey);
      const { data } = await supabase.auth.getUser();
      currentUser = data.user || null;
      await initializeProgress();
    };
    clientScript.onerror = () => initializeLocalStorage();
    document.head.appendChild(clientScript);
  };
  configScript.onerror = () => initializeLocalStorage();
  document.head.appendChild(configScript);

  function initializeLocalStorage() {
    restoreState(loadLocalState());
    attachCellHandlers(saveLocalState);
  }

  async function initializeProgress() {
    if (!supabase || !currentUser) {
      initializeLocalStorage();
      return;
    }

    const { data, error } = await supabase
      .from("pokemon_progress")
      .select("pokemon_id, completed")
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Could not load Supabase progress:", error);
      initializeLocalStorage();
      return;
    }

    const state = {};
    for (const row of data || []) state[row.pokemon_id] = row.completed;
    restoreState(state);
    attachCellHandlers(saveSupabaseState);
  }

  function loadLocalState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function restoreState(state) {
    Object.keys(state).forEach((id) => {
      if (!state[id]) return;
      const cell = document.querySelector(`.cell[data-id="${CSS.escape(id)}"]`);
      if (cell) cell.classList.add("completed");
    });
  }

  function attachCellHandlers(saveHandler) {
    document.querySelectorAll(".cell:not(.empty)").forEach((cell) => {
      cell.addEventListener("click", async () => {
        const id = cell.getAttribute("data-id");
        const completed = cell.classList.toggle("completed");
        await saveHandler(id, completed);
      });
    });
  }

  function saveLocalState(id, completed) {
    const state = loadLocalState();
    state[id] = completed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async function saveSupabaseState(id, completed) {
    const { error } = await supabase.from("pokemon_progress").upsert({
      user_id: currentUser.id,
      pokemon_id: id,
      completed
    });

    if (error) {
      console.error("Could not save Supabase progress:", error);
      // Keep localStorage as a temporary offline fallback.
      saveLocalState(id, completed);
    }
  }
});
