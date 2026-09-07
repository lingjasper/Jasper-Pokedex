(() => {
  'use strict';
  // SINGLE SOURCE OF TRUTH for the website release moniker.
  window.JASPER_POKEDEX_VERSION = 'Release v1.1.0';

  const loadScript = (id,src) => new Promise((resolve,reject) => {
    if (document.getElementById(id)) return resolve();
    const s=document.createElement('script');
    s.id=id;
    s.src=src;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });

  const start = async () => {
    try {
      await loadScript('jasperV103SpriteCard','sprite-card-v103.js');
      await loadScript('jasperPokeApi','pokeapi.js');
      await loadScript('jasperPokedexApiUi','pokedex-api-ui.js');
      await loadScript('jasperInteractionModeV111','interaction-mode-v111.js');
      await loadScript('jasperBulkBannerV111','bulk-banner-v111.js');
    } catch (error) {
      console.error('[Jasper] Release script failed to load.',error);
    }
  };

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
