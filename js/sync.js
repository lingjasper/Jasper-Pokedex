/*
 * sync.js — GitHub persistence for collection progress.
 *
 * Contract (unchanged from earlier releases):
 *   - the token lives only in this browser's localStorage
 *   - each game saves to its own file, saves/<game>.json, on the default branch
 *   - payload: { version: 1, gameId, updatedAt, pokemon: { <entry id>: boolean } }
 *   - commit message: "Update <game id> Pokedex progress"
 *   - the blob SHA that was loaded is sent with every write, so a stale copy
 *     is rejected by GitHub (409) instead of overwriting newer progress
 *
 * This module owns authentication, load, save and sync status. It never
 * touches the DOM; the app passes callbacks for state and status.
 */
import { migrateState, safeStorage } from './core.js';

const TOKEN_KEY = 'jasper_pokedex_github_token';
const SHA_PREFIX = 'jasper_pokedex_save_sha_';
const LAST_SYNC_PREFIX = 'jasper_pokedex_last_synced_at_';
const LEGACY_GAME = 'pokemon-white-2';   // its first save lived in /save.json
const LEGACY_PATH = 'save.json';
const DEFAULT_REPO = { owner: 'lingjasper', name: 'Jasper-Pokedex', branch: 'main' };

/**
 * On GitHub Pages (<owner>.github.io/<repo>/) sync with the repository that
 * serves the page, so a fork writes to the fork. Anywhere else, use the default.
 */
export function detectRepo(location = globalThis.location) {
  const host = String(location?.hostname || '');
  const owner = host.endsWith('.github.io') ? host.slice(0, -'.github.io'.length) : '';
  const name = String(location?.pathname || '').split('/').filter(Boolean)[0] || '';
  if (owner && name && !name.includes('.')) return { owner, name, branch: DEFAULT_REPO.branch };
  return { ...DEFAULT_REPO };
}

const toBase64 = text => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = value => {
  const binary = atob(String(value).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
};

/**
 * host = {
 *   savePath(game)            -> "saves/<game>.json"
 *   entries(game)             -> Promise<entries> (for migrating old key shapes)
 *   getState(game)            -> current local state object
 *   applyRemote(game, state)  -> store + show a state loaded from GitHub
 *   onStatus(status)          -> { state, label, message, lastSynced }
 * }
 */
export function createSync(host, { storage = safeStorage(globalThis.localStorage), fetchImpl = (...args) => fetch(...args), location } = {}) {
  const repo = detectRepo(location);
  const api = `https://api.github.com/repos/${repo.owner}/${repo.name}`;
  const busy = new Set();
  const queued = new Set();
  let activeGame = null;

  const token = () => storage.get(TOKEN_KEY) || '';
  const shaKey = game => `${SHA_PREFIX}${game}`;
  const lastKey = game => `${LAST_SYNC_PREFIX}${game}`;
  const contentsUrl = game => `${api}/contents/${encodeURI(host.savePath(game))}`;

  const LABELS = { none: 'Enter Token', ok: 'Synced', busy: 'Syncing…', error: 'Sync Error' };
  const report = (game, state, message) => {
    if (game !== activeGame) return;
    host.onStatus({ state, label: LABELS[state], message, lastSynced: storage.get(lastKey(game)) });
  };

  const request = async (url, options = {}) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.headers || {})
    };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    // no-store: GitHub lets browsers reuse a contents response for 60 s, and a
    // reused response carries an outdated SHA.
    const response = await fetchImpl(url, { ...options, headers, cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || `GitHub API error ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  };

  const readSave = async url => {
    const file = await request(url);
    const payload = JSON.parse(fromBase64(file.content));
    return { state: payload.pokemon || {}, sha: file.sha, updatedAt: payload.updatedAt || null };
  };
  const getRemote = game => readSave(`${contentsUrl(game)}?ref=${repo.branch}`);
  const getLegacy = () => readSave(`${api}/contents/${LEGACY_PATH}?ref=${repo.branch}`);

  const fail = (game, error, prefix) => {
    if (error.status === 401) {
      storage.remove(TOKEN_KEY);
      storage.remove(shaKey(game));
      report(game, 'error', 'GitHub token is invalid or expired. Enter a new token.');
    } else if (error.status === 409) {
      // Keep the stale SHA: retrying must keep failing rather than overwrite
      // progress that another device saved in the meantime.
      report(game, 'error', 'The save on GitHub changed since it was loaded. Reload the page to pick it up, then save again.');
    } else {
      report(game, 'error', `${prefix}: ${error.message}`);
    }
  };

  async function save(game) {
    if (!token()) return false;
    if (busy.has(game)) { queued.add(game); return false; }
    busy.add(game);
    report(game, 'busy', 'Saving to GitHub…');
    let ok = false;
    try {
      let sha = storage.get(shaKey(game));
      if (!sha) {
        try { sha = (await getRemote(game)).sha; }
        catch (error) { if (error.status !== 404) throw error; }
      }
      const updatedAt = new Date().toISOString();
      const payload = { version: 1, gameId: game, updatedAt, pokemon: host.getState(game) };
      const body = {
        message: `Update ${game} Pokedex progress`,
        content: toBase64(`${JSON.stringify(payload, null, 2)}\n`),
        branch: repo.branch
      };
      if (sha) body.sha = sha;
      const result = await request(contentsUrl(game), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (result.content?.sha) storage.set(shaKey(game), result.content.sha);
      storage.set(lastKey(game), updatedAt);
      report(game, 'ok', 'Synced');
      ok = true;
    } catch (error) {
      fail(game, error, 'Sync failed');
    } finally {
      busy.delete(game);
      if (queued.delete(game)) save(game);
    }
    return ok;
  }

  async function load(game) {
    activeGame = game;
    if (!token()) { report(game, 'none', 'Enter Token'); return false; }
    report(game, 'busy', 'Loading from GitHub…');
    try {
      let remote = null;
      let legacy = false;
      try {
        remote = await getRemote(game);
      } catch (error) {
        if (error.status !== 404) throw error;
        if (game === LEGACY_GAME) {
          try { remote = await getLegacy(); legacy = true; }
          catch (legacyError) { if (legacyError.status !== 404) throw legacyError; }
        }
      }
      if (remote) {
        const entries = await host.entries(game);
        host.applyRemote(game, migrateState(entries, remote.state));
        if (legacy) {
          // First sync after the multi-game migration: write the per-game file.
          storage.remove(shaKey(game));
          return save(game);
        }
        storage.set(shaKey(game), remote.sha);
        if (remote.updatedAt) storage.set(lastKey(game), remote.updatedAt);
      }
      report(game, 'ok', 'Synced');
      return true;
    } catch (error) {
      fail(game, error, 'Could not load the GitHub save');
      return false;
    }
  }

  return {
    repo,
    hasToken: () => !!token(),
    load,
    save,
    /** Store a token and load the active game's save with it. */
    async connect(value, game) {
      const next = String(value || '').trim();
      if (!next) {
        activeGame = game;
        report(game, token() ? 'error' : 'none', 'Paste your GitHub token first.');
        return false;
      }
      storage.set(TOKEN_KEY, next);
      storage.remove(shaKey(game));
      return load(game);
    },
    /** Forget the token and every remembered blob SHA. Local progress is kept. */
    disconnect(games = []) {
      queued.clear();
      storage.remove(TOKEN_KEY);
      for (const game of games) storage.remove(shaKey(game));
      if (activeGame) report(activeGame, 'none', 'Enter a new GitHub token to activate sync.');
    }
  };
}
