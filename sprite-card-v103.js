(() => {
  'use strict';

  const aliases = new Map([
    ['basculin|red', 'basculin'], ['basculin|blue', 'basculin-blue-striped'], ['basculin|red-striped', 'basculin'], ['basculin|blue-striped', 'basculin-blue-striped'],
    ['diglett|alolan', 'diglett-alola'], ['dugtrio|alolan', 'dugtrio-alola'], ['geodude|alolan', 'geodude-alola'], ['graveler|alolan', 'graveler-alola'], ['golem|alolan', 'golem-alola'],
    ['meowth|alolan', 'meowth-alola'], ['persian|alolan', 'persian-alola'], ['rattata|alolan', 'rattata-alola'], ['raticate|alolan', 'raticate-alola'],
    ['raichu|alolan', 'raichu-alola'], ['sandshrew|alolan', 'sandshrew-alola'], ['sandslash|alolan', 'sandslash-alola'], ['vulpix|alolan', 'vulpix-alola'], ['ninetales|alolan', 'ninetales-alola'], ['marowak|alolan', 'marowak-alola'],
    ['exeggutor|alolan', 'exeggutor-alola'], ['grimer|alolan', 'grimer-alola'], ['muk|alolan', 'muk-alola']
  ]);
  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const slug = v => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/-+/g, '-');
  const resolveCandidates = (name, form) => {
    const n = norm(name), f = norm(form), key = `${n}|${f}`;
    const out = [];
    if (aliases.has(key)) out.push(aliases.get(key));
    if (f) out.push(`${slug(n)}-${slug(f)}`);
    out.push(slug(n));
    return [...new Set(out)];
  };
  const cache = new Map();
  const resolve = (name, form = '') => {
    const key = `${norm(name)}|${norm(form)}`;
    if (!cache.has(key)) cache.set(key, (async () => {
      for (const candidate of resolveCandidates(name, form)) {
        const r = await fetch(`Sprites/${encodeURIComponent(candidate)}.png`, { cache: 'no-store' });
        if (r.ok) return `Sprites/${candidate}.png`;
      }
      return null;
    })());
    return cache.get(key);
  };
  const applySprite = async (img, name, form) => {
    const src = await resolve(name, form);
    if (!src) { img.dataset.spriteMissing = 'true'; return false; }
    img.src = src;
    img.dataset.spriteMissing = 'false';
    return true;
  };

  const css = `
    .grid-wrapper .grid { container-type:inline-size; container-name:pokemon-grid; }
    .cell.pokemon-card { position:relative; box-sizing:border-box; display:flex; width:100%; min-width:180px; height:78px; padding:12px; align-items:flex-start; gap:10px; border-radius:6px; overflow:hidden; opacity:1!important; }
    .pokemon-card .pokemon-card-text { display:flex; flex-direction:column; justify-content:space-between; align-items:flex-start; flex:1 0 0; align-self:stretch; min-width:0; position:relative; z-index:4; opacity:1; }
    .pokemon-card .pokemon-name-frame { display:flex; flex-direction:column; align-items:flex-start; min-width:0; max-width:100%; }
    .pokemon-card .pokemon-name,.pokemon-card .pokemon-form,.pokemon-card .pokemon-dex-num { margin:0; }
    .pokemon-card .pokemon-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pokemon-card .pokemon-sprite { width:136px; height:112px; position:absolute; right:-17px; top:-41px; object-fit:contain; image-rendering:pixelated; pointer-events:none; user-select:none; z-index:3; opacity:1!important; will-change:transform; }
    .pokemon-card .checkbox { display:none!important; }

    @keyframes jasperPokemonExcitedDesktop {
      0%,100% { transform:translateY(0); }
      50% { transform:translateY(-2px); }
    }
    @keyframes jasperPokemonExcitedMobile {
      0%,100% { transform:translateX(-50%) translateY(0); }
      50% { transform:translateX(-50%) translateY(-1px); }
    }
    @keyframes jasperPokedexBorderSpin {
      from { transform:rotate(0deg); }
      to { transform:rotate(360deg); }
    }

    @media (min-width:641px) {
      .pokemon-card:hover,
      .pokemon-card.pokedex-active { overflow:visible; z-index:20; }
      .pokemon-card:hover .pokemon-sprite,
      .pokemon-card.pokedex-active .pokemon-sprite { animation:jasperPokemonExcitedDesktop .333s steps(2,end) infinite; }
      .pokemon-card::after {
        content:"";
        position:absolute;
        inset:0;
        padding:2px;
        border-radius:inherit;
        background:conic-gradient(from 0deg,transparent 0deg,transparent 285deg,#60A5FA 320deg,#5B9CFF 342deg,transparent 360deg);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor;
        mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        mask-composite:exclude;
        pointer-events:none;
        z-index:8;
        opacity:0;
      }
      .pokemon-card.pokedex-active::after { opacity:1; animation:jasperPokedexBorderSpin 1.8s linear infinite; }
      .pokemon-card .pokedex-button {
        position:absolute;
        left:0;
        bottom:-34px;
        width:100%;
        min-height:28px;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:6px;
        gap:4px;
        box-sizing:border-box;
        border:1px solid #60A5FA;
        border-radius:4px;
        background:#F8FAFC;
        color:#2563EB;
        font-size:12px;
        font-weight:700;
        line-height:1;
        cursor:pointer;
        opacity:0;
        pointer-events:none;
        transition:opacity .12s ease,background .12s ease;
        z-index:30;
      }
      .pokemon-card:hover .pokedex-button,
      .pokemon-card.pokedex-active .pokedex-button { opacity:1; pointer-events:auto; }
      .pokemon-card .pokedex-button:hover { background:#EFF6FF; }
      html[data-theme="dark"] .pokemon-card .pokedex-button { border-color:#4979B6; background:#242831; color:#93C5FD; }
      html[data-theme="dark"] .pokemon-card .pokedex-button:hover { background:#1D3150; }
    }

    #pokedexDetailPanel { display:flex; flex-direction:column; min-height:0; width:100%; height:100%; gap:16px; color:#0f172a; }
    #pokedexDetailPanel[hidden] { display:none; }
    #pokedexDetailHeader { display:flex; align-items:center; justify-content:space-between; gap:12px; flex:0 0 auto; }
    #pokedexDetailTitle { margin:0; font-size:1.05rem; line-height:1.2; font-weight:700; }
    #pokedexDetailClose { width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; flex:0 0 28px; border:1px solid #CBD5E1; border-radius:6px; background:#F8FAFC; color:#475569; cursor:pointer; font-size:18px; line-height:1; }
    #pokedexDetailClose:hover { background:#EFF6FF; border-color:#60A5FA; color:#2563EB; }
    #pokedexDetailBody { min-height:0; overflow:auto; padding:12px; border:1px solid #CBD5E1; border-radius:8px; background:#F8FAFC; font-size:.82rem; line-height:1.5; }
    #pokedexDetailBody strong { font-weight:700; }
    html[data-theme="dark"] #pokedexDetailPanel { color:#f8fafc; }
    html[data-theme="dark"] #pokedexDetailClose { border-color:#343A46; background:#242831; color:#cbd5e1; }
    html[data-theme="dark"] #pokedexDetailClose:hover { background:#1D3150; border-color:#4979B6; color:#93C5FD; }
    html[data-theme="dark"] #pokedexDetailBody { border-color:#343A46; background:#242831; color:#f8fafc; }

    @media (prefers-reduced-motion: reduce) {
      .pokemon-card:hover .pokemon-sprite,
      .pokemon-card.pokedex-active .pokemon-sprite,
      .pokemon-card.pokedex-active::after { animation:none!important; }
    }

    @container pokemon-grid (max-width:1109px) {
      .cell.pokemon-card { width:100%; min-width:110px; max-width:179px; height:80px; min-height:80px; padding:6px 12px; align-items:center; gap:10px; }
      .pokemon-card .pokemon-card-text { align-items:center; text-align:center; }
      .pokemon-card .pokemon-name-frame { align-items:center; }
      .pokemon-card .pokemon-dex-num { position:absolute; left:0; bottom:0; }
      .pokemon-card .pokemon-form { position:absolute; right:0; bottom:0; }
      .pokemon-card .pokemon-sprite { width:68px; height:56px; left:50%; right:auto; top:1px; transform:translateX(-50%); image-rendering:pixelated; }
      .pokemon-card.no-form .pokemon-dex-num { left:50%; right:auto; transform:translateX(-50%); }
    }
  `;
  const style = document.createElement('style'); style.id='jasperV103SpriteCardStyles'; document.head.appendChild(style); style.textContent=css;

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const parseName = v => { const m=String(v||'').trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/); return {name:m?m[1].trim():String(v||'').trim(),form:m?m[2].trim():''}; };

  const ensureDetailPanel = () => {
    const side=document.getElementById('desktopRightSidebar');
    if(!side)return null;
    let panel=document.getElementById('pokedexDetailPanel');
    if(panel)return panel;
    side.innerHTML='<section id="pokedexDetailPanel" hidden><header id="pokedexDetailHeader"><h2 id="pokedexDetailTitle">Pokédex</h2><button id="pokedexDetailClose" type="button" aria-label="Close Pokédex">×</button></header><div id="pokedexDetailBody"></div></section>';
    panel=document.getElementById('pokedexDetailPanel');
    document.getElementById('pokedexDetailClose')?.addEventListener('click',()=>closePokedex());
    return panel;
  };

  const closePokedex = () => {
    document.querySelectorAll('.pokemon-card.pokedex-active').forEach(card=>card.classList.remove('pokedex-active'));
    const panel=document.getElementById('pokedexDetailPanel');
    if(panel)panel.hidden=true;
    window.JASPER_POKEDEX_DETAIL=null;
  };

  const openPokedex = card => {
    const panel=ensureDetailPanel();
    if(!panel)return;
    document.querySelectorAll('.pokemon-card.pokedex-active').forEach(other=>{if(other!==card)other.classList.remove('pokedex-active');});
    card.classList.add('pokedex-active');
    const parsed=parseName(card.dataset.name||'');
    const dex=card.dataset.num||card.querySelector('.pokemon-dex-num')?.textContent?.trim()||'';
    const body=document.getElementById('pokedexDetailBody');
    const title=document.getElementById('pokedexDetailTitle');
    if(title)title.textContent=parsed.name||'Pokédex';
    if(body)body.innerHTML=`<strong>${esc(parsed.name)}</strong><br>National Dex #${esc(dex)}${parsed.form?`<br>Form: ${esc(parsed.form)}`:''}<br><br>Pokédex data panel ready.<br><br>Evolution and wild-location data will be connected through the PokéAPI adapter in the next step.`;
    panel.hidden=false;
    window.JASPER_POKEDEX_DETAIL={id:card.dataset.id||'',name:parsed.name,form:parsed.form,dex};
  };

  const bindPokedex = () => {
    const root=document.getElementById('boxContainer');
    if(!root||root.dataset.pokedexBound==='true')return;
    root.dataset.pokedexBound='true';
    root.addEventListener('click',event=>{
      const button=event.target.closest('.pokedex-button');
      if(!button||!root.contains(button))return;
      event.preventDefault();
      event.stopPropagation();
      const card=button.closest('.pokemon-card');
      if(card)openPokedex(card);
    });
  };

  const renderCard = async card => {
    if (card.classList.contains('empty') || card.classList.contains('pokemon-card')) return;
    const parsed=parseName(card.dataset.name); if(!parsed.name)return;
    const dex=card.dataset.num || card.querySelector('.dex-num')?.textContent?.trim() || '';
    card.classList.add('pokemon-card', parsed.form ? 'has-form' : 'no-form');
    card.innerHTML=`<span class="pokemon-card-text"><span class="pokemon-name-frame"><span class="name pokemon-name">${esc(parsed.name)}</span>${parsed.form?`<span class="form pokemon-form">${esc(parsed.form)}</span>`:''}</span><span class="dex-num pokemon-dex-num">${esc(dex)}</span></span><img class="pokemon-sprite" alt="" aria-hidden="true" decoding="async" draggable="false"><button class="pokedex-button" type="button">Pokedex</button>`;
    await applySprite(card.querySelector('.pokemon-sprite'), parsed.name, parsed.form);
  };

  const upgrade=root=>root.querySelectorAll?.('.cell[data-id]:not(.empty):not(.pokemon-card)').forEach(renderCard);
  const start=()=>{
    const target=document.getElementById('boxContainer')||document.body;
    bindPokedex();
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeType!==1)return;
      n.matches?.('.cell[data-id]:not(.empty)')?renderCard(n):upgrade(n);
    }))).observe(target,{childList:true,subtree:true});
    upgrade(document);
    bindPokedex();
  };

  window.JASPER_SPRITES={resolve,apply:applySprite};
  window.JASPER_POKEDEX_UI={open:openPokedex,close:closePokedex};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
