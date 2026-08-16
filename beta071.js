(() => {
  'use strict';
  const BASE = 'beta071-base.js?v=0.10.6';
  const BETA_LABEL = 'Beta v0.10.6';
  const setMoniker = () => document.querySelectorAll('#pokedexBetaMoniker,.desktop-sidebar-brand .beta,.desktop-beta').forEach(el => el.textContent = BETA_LABEL);
  const loadBase = () => { const script=document.createElement('script'); script.src=BASE; script.onload=setMoniker; script.onerror=setMoniker; document.head.appendChild(script); };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setMoniker();loadBase();},{once:true});else{setMoniker();loadBase();}
})();
