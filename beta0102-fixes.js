(() => {
  'use strict';
  const RELEASE = 'Beta v0.10.6';
  const repairLegacyUI = () => {
    document.querySelectorAll('.v0102-jump').forEach(el => el.remove());
    document.querySelectorAll('#pokedexBetaMoniker,.desktop-sidebar-brand .beta,.desktop-beta').forEach(el => el.textContent = RELEASE);
    const input=document.getElementById('searchInput');
    if(input&&window.matchMedia('(max-width:640px)').matches){input.placeholder='Search...';input.style.fontSize='16px';}
  };
  const boot=()=>{repairLegacyUI();[100,300,750,1500].forEach(ms=>window.setTimeout(repairLegacyUI,ms));};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
