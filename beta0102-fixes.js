(() => {
  'use strict';

  const BETA_LABEL = 'Beta v0.10.2';

  const setMoniker = () => {
    const mobile = document.getElementById('pokedexBetaMoniker');
    if (mobile) mobile.textContent = BETA_LABEL;
    document.querySelectorAll('.desktop-sidebar-brand .beta').forEach(el => { el.textContent = BETA_LABEL; });
  };

  const installSearch = () => {
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    const wrapper = document.querySelector('.search-wrapper');
    if (!input || !results || !wrapper || wrapper.dataset.v0102Search) return;
    wrapper.dataset.v0102Search = '1';

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.id = 'searchClearButton';
    clear.setAttribute('aria-label', 'Clear search');
    clear.title = 'Clear search';
    clear.textContent = '×';
    wrapper.appendChild(clear);

    const style = document.createElement('style');
    style.textContent = `
      #searchClearButton{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:50%;background:#e2e8f0;color:#475569;font-size:18px;line-height:22px;padding:0;cursor:pointer;display:none;z-index:2}
      #searchClearButton:hover{background:#cbd5e1}
      .search-input{padding-right:40px!important}
      .v0102-jump{display:flex;align-items:center;gap:8px;margin:0 0 10px 0;padding:8px 0}
      .v0102-jump label{font-size:.82rem;font-weight:700;color:#475569;white-space:nowrap}
      .v0102-jump select{flex:0 1 280px;padding:7px 10px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#1e293b}
    `;
    document.head.appendChild(style);

    const render = () => {
      const query = input.value.trim().toLowerCase();
      clear.style.display = query ? 'block' : 'none';
      results.replaceChildren();
      if (!query) { results.style.display = 'none'; return; }
      const data = window.JASPER_POKEDEX?.pokemon || [];
      const matches = data.filter(p => p.name.toLowerCase().includes(query) || p.baseName.toLowerCase().includes(query) || p.num === query).slice(0, 50);
      matches.forEach(p => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.id = p.id;
        item.dataset.num = p.num;
        item.innerHTML = `<span class="dex-num">${p.num}</span><span class="name">${p.baseName}${p.form ? ` <span class="form">${p.form}</span>` : ''}</span>`;
        item.addEventListener('click', () => {
          const target = document.querySelector(`#boxContainer [data-id="${CSS.escape(p.id)}"], #listContainer [data-id="${CSS.escape(p.id)}"]`);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          input.value = p.name;
          clear.style.display = 'block';
          results.style.display = 'none';
        });
        results.appendChild(item);
      });
      results.style.display = matches.length ? 'block' : 'none';
    };

    input.addEventListener('input', render);
    clear.addEventListener('click', () => {
      input.value = '';
      input.focus();
      render();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { input.value = ''; render(); }
    });
  };

  const installJump = () => {
    const list = document.getElementById('listContainer');
    const data = window.JASPER_POKEDEX?.pokemon || [];
    if (!list || !data.length || list.dataset.v0102Jump) return;
    list.dataset.v0102Jump = '1';

    const controls = document.createElement('div');
    controls.className = 'v0102-jump';
    controls.innerHTML = '<label for="v0102JumpSelect">Jump to:</label><select id="v0102JumpSelect"><option value="">Select Pokémon...</option></select>';
    const select = controls.querySelector('select');
    data.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `#${p.num} — ${p.name}`;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      if (!select.value) return;
      document.querySelector(`#listContainer [data-id="${CSS.escape(select.value)}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' });
    });
    list.prepend(controls);
  };

  const boot = () => {
    setMoniker();
    installSearch();
    installJump();
    window.setTimeout(setMoniker, 100);
    window.setTimeout(installSearch, 100);
    window.setTimeout(installJump, 250);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
