(() => {
  'use strict';

  /* v1.1.1 — Bulk Mode banner presentation layer. Transaction behavior remains owned by beta071-base.js. */
  const isMobile = () => window.matchMedia('(max-width:640px)').matches;

  const installStyles = () => {
    if (document.getElementById('jasperBulkBannerStyles')) return;
    const style = document.createElement('style');
    style.id = 'jasperBulkBannerStyles';
    style.textContent = `
      #bulkModeSection .bulk-toggle-row::before { content:'Manage PC'!important; }
      #bulkActions { display:none!important; }

      #bulkModeBanner {
        display:flex;
        width:100%;
        height:44px;
        box-sizing:border-box;
        padding:6px 17px 6px 5px;
        justify-content:space-between;
        align-items:center;
        border-radius:6px;
        border:1px solid #4979B6;
        background:#1D3150;
        color:#fff;
        flex:0 0 auto;
      }
      #bulkModeBanner[hidden] { display:none!important; }
      #bulkModeBanner .bulk-banner-message {
        display:flex;
        align-items:center;
        gap:4px;
        min-width:0;
        font-size:.82rem;
        font-weight:600;
        line-height:1.2;
      }
      #bulkModeBanner .bulk-banner-icon {
        width:20px;
        height:20px;
        flex:0 0 20px;
        object-fit:contain;
        display:block;
      }
      #bulkModeBanner .bulk-banner-actions {
        display:flex;
        align-items:center;
        gap:12px;
        flex:0 0 auto;
        white-space:nowrap;
      }
      #bulkModeBanner button {
        appearance:none;
        border:0;
        padding:0;
        margin:0;
        background:transparent;
        color:inherit;
        font:inherit;
        font-weight:600;
        line-height:1;
        cursor:pointer;
      }
      #bulkModeBanner .bulk-banner-divider { opacity:.75; }
      #bulkModeBanner button:disabled { opacity:.5; cursor:not-allowed; }

      @media (min-width:641px) {
        #bulkModeBanner { width:100%; }
      }
      @media (max-width:640px) {
        #bulkModeBanner {
          width:100%;
          margin:0 0 14px;
          padding:6px 12px 6px 5px;
        }
        #bulkModeBanner .bulk-banner-message { font-size:.75rem; }
        #bulkModeBanner .bulk-banner-actions { gap:10px; }
      }
    `;
    document.head.appendChild(style);
  };

  const findCompletionBanner = () => isMobile()
    ? document.getElementById('mobileProgressBanner')
    : document.getElementById('dexProgressBanner');

  const placeBanner = () => {
    const completion = findCompletionBanner();
    const banner = document.getElementById('bulkModeBanner');
    if (!completion || !banner) return false;
    if (banner.previousElementSibling !== completion) completion.insertAdjacentElement('afterend', banner);
    return true;
  };

  const getPendingCount = () => {
    const text = document.getElementById('bulkPendingCount')?.textContent || '';
    const match = text.match(/^(\d+)/);
    return match ? Number(match[1]) : 0;
  };

  const updateBanner = () => {
    const banner = document.getElementById('bulkModeBanner');
    const toggle = document.getElementById('bulkModeToggle');
    if (!banner || !toggle) return;
    const active = toggle.checked === true;
    banner.hidden = !active;
    const count = getPendingCount();
    const text = banner.querySelector('.bulk-banner-text');
    if (text) text.textContent = count > 0
      ? `Catch multiple Pokémon to send to your PC box, or release them from it. You have ${count} pending changes.`
      : 'Catch multiple Pokémon to send to your PC box, or release them from it.';
    const save = banner.querySelector('[data-action="save"]');
    if (save) save.disabled = count === 0;
    placeBanner();
  };

  const installBanner = () => {
    if (document.getElementById('bulkModeBanner')) return true;
    const section = document.getElementById('bulkModeSection');
    if (!section) return false;

    const banner = document.createElement('section');
    banner.id = 'bulkModeBanner';
    banner.hidden = true;
    banner.setAttribute('aria-label', 'Manage PC');
    banner.innerHTML = `
      <div class="bulk-banner-message">
        <img class="bulk-banner-icon" src="Icons/ManagePC.png" alt="">
        <span class="bulk-banner-text">Catch multiple Pokémon to send to your PC box, or release them from it.</span>
      </div>
      <div class="bulk-banner-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <span class="bulk-banner-divider" aria-hidden="true">|</span>
        <button type="button" data-action="save" disabled>Save changes</button>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('[data-action="cancel"]').addEventListener('click', event => {
      event.stopPropagation();
      document.getElementById('bulkCancelBtn')?.click();
    });
    banner.querySelector('[data-action="save"]').addEventListener('click', event => {
      event.stopPropagation();
      document.getElementById('bulkCommitBtn')?.click();
    });
    return true;
  };

  const bind = () => {
    const toggle = document.getElementById('bulkModeToggle');
    if (!toggle) return false;
    if (toggle.dataset.bulkBannerBound !== 'true') {
      toggle.dataset.bulkBannerBound = 'true';
      toggle.addEventListener('change', () => setTimeout(updateBanner, 0));
    }
    return true;
  };

  const observe = () => {
    const sync = () => {
      installStyles();
      if (installBanner()) {
        bind();
        updateBanner();
      }
    };
    sync();
    new MutationObserver(sync).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', sync, { passive:true });
  };

  const start = () => observe();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
