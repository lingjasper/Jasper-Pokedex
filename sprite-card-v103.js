(() => {
  'use strict';

  const css = `
    .grid-wrapper .grid { container-type: inline-size; container-name: pokemon-grid; }
    .cell.pokemon-card {
      position: relative;
      box-sizing: border-box;
      display: flex;
      width: 100%;
      min-width: 180px;
      height: 78px;
      padding: 12px;
      align-items: flex-start;
      gap: 10px;
      border-radius: 6px;
      overflow: hidden;
    }
    .pokemon-card .pokemon-card-text {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-start;
      flex: 1 0 0;
      align-self: stretch;
      min-width: 0;
      position: relative;
      z-index: 2;
    }
    .pokemon-card .pokemon-name-frame {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
      max-width: 100%;
    }
    .pokemon-card .pokemon-name,
    .pokemon-card .pokemon-form,
    .pokemon-card .pokemon-dex-num { margin: 0; }
    .pokemon-card .pokemon-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pokemon-card .pokemon-form { margin-top: 0; }
    .pokemon-card .pokemon-sprite {
      width: 136px;
      height: 112px;
      position: absolute;
      right: -17px;
      top: -41px;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
      z-index: 1;
    }
    .pokemon-card .checkbox { display: none !important; }
    .cell.pokemon-card.completed.bulk-pending {
      background-color: #3D1C1C !important;
      border-color: #6C2A2A !important;
    }
    @container pokemon-grid (max-width: 1115px) {
      .cell.pokemon-card {
        width: 110px;
        min-width: 110px;
        max-width: 110px;
        height: 68px;
        min-height: 68px;
        padding: 6px 12px;
        align-items: center;
        gap: 10px;
      }
      .pokemon-card .pokemon-card-text {
        align-items: center;
        text-align: center;
      }
      .pokemon-card .pokemon-name-frame { align-items: center; }
      .pokemon-card .pokemon-dex-num { align-self: flex-start; }
      .pokemon-card .pokemon-form { align-self: flex-end; }
      .pokemon-card .pokemon-sprite {
        width: 68px;
        height: 56px;
        left: 21px;
        right: auto;
        top: 1px;
      }
    }
  `;
  const style = document.createElement('style');
  style.id = 'jasperV103SpriteCardStyles';
  style.textContent = css;
  document.head.appendChild(style);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const parseName = value => {
    const raw = String(value || '').trim();
    const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    return { name: match ? match[1].trim() : raw, form: match ? match[2].trim() : '' };
  };

  const renderCard = async card => {
    if (card.classList.contains('empty') || card.classList.contains('pokemon-card')) return;
    const { name, form } = parseName(card.dataset.name || '');
    if (!name) return;

    card.classList.add('pokemon-card');
    const dex = card.querySelector('.dex-num')?.textContent?.trim() || card.dataset.num || '';
    const formText = form ? `<span class="form pokemon-form">${esc(`(${form})`)}</span>` : '';
    card.innerHTML = `
      <span class="pokemon-card-text">
        <span class="pokemon-name-frame">
          <span class="name pokemon-name">${esc(name)}</span>
          ${formText}
        </span>
        <span class="dex-num pokemon-dex-num">${esc(dex)}</span>
      </span>
      <img class="pokemon-sprite" alt="" aria-hidden="true" decoding="async" draggable="false">
    `;
    const img = card.querySelector('.pokemon-sprite');
    if (window.JASPER_SPRITES) {
      await window.JASPER_SPRITES.apply(img, name, form);
    }
  };

  const upgrade = root => {
    root.querySelectorAll?.('.cell[data-id]:not(.empty):not(.pokemon-card)').forEach(renderCard);
  };

  const observe = () => {
    upgrade(document);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches?.('.cell[data-id]:not(.empty)')) renderCard(node);
          else upgrade(node);
        });
      }
    });
    observer.observe(document.getElementById('boxContainer') || document.body, { childList: true, subtree: true });
  };

  // The engine owns collection state and click handling. This layer only changes
  // the card DOM/presentation, so completed/bulk-pending classes remain authoritative.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})();
