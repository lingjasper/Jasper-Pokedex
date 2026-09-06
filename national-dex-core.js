(() => {
  'use strict';

  /* v1.0.1 — National Dex foundation.
   * This module does not render a National Dex. It defines the normalized
   * aggregation boundary so future game datasets/saves can be combined
   * without sharing or mutating game-specific collection state. */

  const VERSION = 1;
  const keyOf = (speciesId, formId = null) => `${Number(speciesId)}::${formId || ''}`;

  const normalizeGameEntry = (gameId, entry, state = {}) => {
    if (!gameId || !entry || entry.globalSpeciesId == null || !entry.entryId) return null;
    return {
      gameId,
      entryId: String(entry.entryId),
      globalSpeciesId: Number(entry.globalSpeciesId),
      globalFormId: entry.globalFormId == null ? null : String(entry.globalFormId),
      name: String(entry.name || entry.baseName || ''),
      available: entry.available !== false,
      obtained: state[entry.entryId] === true
    };
  };

  const aggregate = gameSources => {
    const index = new Map();
    for (const source of Array.isArray(gameSources) ? gameSources : []) {
      const gameId = source?.gameId;
      const entries = Array.isArray(source?.entries) ? source.entries : [];
      const state = source?.state && typeof source.state === 'object' ? source.state : {};
      for (const entry of entries) {
        const normalized = normalizeGameEntry(gameId, entry, state);
        if (!normalized) continue;
        const key = keyOf(normalized.globalSpeciesId, normalized.globalFormId);
        if (!index.has(key)) {
          index.set(key, {
            globalSpeciesId: normalized.globalSpeciesId,
            globalFormId: normalized.globalFormId,
            name: normalized.name,
            games: []
          });
        }
        index.get(key).games.push({
          gameId: normalized.gameId,
          entryId: normalized.entryId,
          available: normalized.available,
          obtained: normalized.obtained
        });
      }
    }
    return [...index.values()].sort((a, b) => a.globalSpeciesId - b.globalSpeciesId || String(a.globalFormId || '').localeCompare(String(b.globalFormId || '')));
  };

  const ownership = record => (record?.games || []).filter(g => g.obtained).map(g => g.gameId);

  window.JASPER_NATIONAL_DEX = Object.freeze({
    schemaVersion: VERSION,
    keyOf,
    normalizeGameEntry,
    aggregate,
    ownership
  });
})();
