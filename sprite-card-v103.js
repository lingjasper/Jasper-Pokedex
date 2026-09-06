(() => {
  'use strict';

  const aliases = new Map([
    ['basculin|red', 'basculin'],
    ['basculin|blue', 'basculin-blue-striped'],
    ['basculin|red-striped', 'basculin'],
    ['basculin|blue-striped', 'basculin-blue-striped'],
    ['diglett|alolan', 'diglett-alola'], ['dugtrio|alolan', 'dugtrio-alola'],
    ['geodude|alolan', 'geodude-alola'], ['graveler|alolan', 'graveler-alola'], ['golem|alolan', 'golem-alola'],
    ['meowth|alolan', 'meowth-alola'], ['persian|alolan', 'persian-alola'],
    ['rattata|alolan', 'rattata-alola'], ['raticate|alolan', 'raticate-alola'],
    ['raichu|alolan', 'raichu-alola'], ['sandshrew|alolan', 'sandshrew-alola'], ['sandslash|alolan', 'sandslash-alola'],
    ['vulpix|alolan', 'vulpix-alola'], ['ninetales|alolan', 'ninetales-alola'], ['marowak|alolan', 'marowak-alola'],
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
    .cell.pokemon-card { position:relative; box-sizing:border-box; display:flex; width:100%; min-width:180px; height:78px; padding:12px; align-items:flex-start; gap:10px; border-radius:6px; overflow:hidden; }
    .pokemon-card .pokemon-card-text { display:flex; flex-direction:column; justify-content:space-between; align-items:flex-start; flex:1 0 0; align-self:stretch; min-width:0; position:relative; z-index:2; }
    .pokemon-card .pokemon-name-frame { display:flex; flex-direction:column; align-items:flex-start; min-width:0; max-width:100%; }
    .pokemon-card .pokemon-name,.pokemon-card .pokemon-form,.pokemon-card .pokemon-dex-num { margin:0; }
    .pokemon-card .pokemon-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pokemon-card .pokemon-sprite { width:136px; height:112px; position:absolute; right:-17px; top:-41px; object-fit:contain; pointer-events:none; user-select:none; z-index:1; }
    .pokemon-card .checkbox { display:none!important; }
    .cell.pokemon-card.completed.bulk-pending { background-color:#3D1C1C!important; border-color:#6C2A2A!important; }
    @container pokemon-grid (max-width:1109px) {
      .cell.pokemon-card { width:110px; min-width:110px; max-width:110px; height:68px; min-height:68px; padding:6px 12px; align-items:center; gap:10px; }
      .pokemon-card .pokemon-card-text { align-items:center; text-align:center; }
      .pokemon-card .pokemon-name-frame { align-items:center; }
      .pokemon-card .pokemon-dex-num { align-self:flex-start; }
      .pokemon-card .pokemon-form { align-self:flex-end; }
      .pokemon-card .pokemon-sprite { width:68px; height:56px; left:21px; right:auto; top:1px; }
    }
  `;
  const style = document.createElement('style'); style.id='jasperV103SpriteCardStyles'; style.textContent=css; document.head.appendChild(style);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const parseName = v => { const m=String(v||'').trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/); return {name:m?m[1].trim():String(v||'').trim(),form:m?m[2].trim():''}; };
  const renderCard = async card => {
    if (card.classList.contains('empty') || card.classList.contains('pokemon-card')) return;
    const parsed=parseName(card.dataset.name); if(!parsed.name)return;
    const dex=card.dataset.num || card.querySelector('.dex-num')?.textContent?.trim() || '';
    card.classList.add('pokemon-card');
    card.innerHTML=`<span class="pokemon-card-text"><span class="pokemon-name-frame"><span class="name pokemon-name">${esc(parsed.name)}</span>${parsed.form?`<span class="form pokemon-form">(${esc(parsed.form)})</span>`:''}</span><span class="dex-num pokemon-dex-num">${esc(dex)}</span></span><img class="pokemon-sprite" alt="" aria-hidden="true" decoding="async" draggable="false">`;
    await applySprite(card.querySelector('.pokemon-sprite'), parsed.name, parsed.form);
  };
  const upgrade=root=>root.querySelectorAll?.('.cell[data-id]:not(.empty):not(.pokemon-card)').forEach(renderCard);
  const start=()=>{
    upgrade(document);
    const target=document.getElementById('boxContainer')||document.body;
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType!==1)return;n.matches?.('.cell[data-id]:not(.empty)')?renderCard(n):upgrade(n);}))).observe(target,{childList:true,subtree:true});
  };
  window.JASPER_SPRITES={resolve,apply:applySprite};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
