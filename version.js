(() => {
  'use strict';
  // SINGLE SOURCE OF TRUTH for the website release moniker.
  window.JASPER_POKEDEX_VERSION = 'Release v1.2.0';

  const updateMoniker = () => {
    const value = window.JASPER_POKEDEX_VERSION || '';
    document.querySelectorAll('#mobileHeaderMoniker,.desktop-sidebar-brand .beta').forEach(el => {
      if (el.textContent !== value) el.textContent = value;
    });
  };

  const observeMoniker = () => {
    updateMoniker();
    if (!document.body) return;
    const observer = new MutationObserver(() => {
      updateMoniker();
      const mobile = document.getElementById('mobileHeaderMoniker');
      const desktop = document.querySelector('.desktop-sidebar-brand .beta');
      if (mobile || desktop) observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(() => observer.disconnect(),5000);
  };

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
    } catch (error) {
      console.error('[Jasper] Release script failed to load.',error);
    }
    observeMoniker();
  };

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
