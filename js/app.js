(() => {
  // Prevent duplicate initialization if app.js is included more than once.
  if (window.__B2W2_DEX_APP_INITIALIZED__) return;
  window.__B2W2_DEX_APP_INITIALIZED__ = true;

  const STORAGE_KEY = "b2w2_living_dex_saved_state";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  let supabase = null;
  let currentUser = null;
  let saveHandler = saveLocalState;

  function loadLocalState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveLocalState(id, completed) {
    const state = loadLocalState();
    state[id] = completed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function restoreState(state) {
    document.querySelectorAll(".cell[data-id]").forEach((cell) => {
      cell.classList.toggle("completed", state[cell.dataset.id] === true);
    });
  }

  // Event delegation keeps every Pokémon cell clickable and avoids duplicate
  // handlers if the page is rendered or modified more than once.
  document.addEventListener("click", async (event) => {
    const cell = event.target.closest(".cell[data-id]:not(.empty)");
    if (!cell) return;

    const id = cell.dataset.id;
    const completed = !cell.classList.contains("completed");

    // Update the visual state immediately; saving happens afterward.
    cell.classList.toggle("completed", completed);

    try {
      await saveHandler(id, completed);
    } catch (error) {
      console.error("Could not save checkbox state:", error);
      saveLocalState(id, completed);
    }
  });

  function loadSupabaseConfig() {
    return new Promise((resolve) => {
      if (window.SUPABASE_CONFIG) {
        resolve(window.SUPABASE_CONFIG);
        return;
      }

      const script = document.createElement("script");
      script.src = "js/supabase.js";
      script.onload = () => resolve(window.SUPABASE_CONFIG || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  function loadSupabaseClient() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) {
        resolve(window.supabase);
        return;
      }

      const script = document.createElement("script");
      script.src = SUPABASE_CDN;
      script.onload = () => {
        if (window.supabase?.createClient) resolve(window.supabase);
        else reject(new Error("Supabase client did not load."));
      };
      script.onerror = () => reject(new Error("Supabase client failed to load."));
      document.head.appendChild(script);
    });
  }

  async function initializeSupabase() {
    try {
      const config = await loadSupabaseConfig();
      if (!config?.url || !config?.anonKey || config.url.startsWith("YOUR_") || config.anonKey.startsWith("YOUR_")) {
        restoreState(loadLocalState());
        return;
      }

      const supabaseLib = await loadSupabaseClient();
      supabase = supabaseLib.createClient(config.url, config.anonKey);

      const { data: sessionData } = await supabase.auth.getSession();
      currentUser = sessionData?.session?.user || null;

      if (!currentUser) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        currentUser = data?.user || null;
      }

      if (!currentUser) throw new Error("No Supabase user was created.");

      const { data, error } = await supabase
        .from("pokemon_progress")
        .select("pokemon_id, completed")
        .eq("user_id", currentUser.id);

      if (error) throw error;

      const state = {};
      for (const row of data || []) {
        state[row.pokemon_id] = row.completed === true;
      }

      restoreState(state);
      saveHandler = saveSupabaseState;
    } catch (error) {
      console.error("Supabase initialization failed; using local storage:", error);
      restoreState(loadLocalState());
      saveHandler = saveLocalState;
    }
  }

  async function saveSupabaseState(id, completed) {
    if (!supabase || !currentUser) {
      saveLocalState(id, completed);
      return;
    }

    const { error } = await supabase.from("pokemon_progress").upsert(
      {
        user_id: currentUser.id,
        pokemon_id: id,
        completed
      },
      { onConflict: "user_id,pokemon_id" }
    );

    if (error) {
      saveLocalState(id, completed);
      throw error;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSupabase, { once: true });
  } else {
    initializeSupabase();
  }
})();
