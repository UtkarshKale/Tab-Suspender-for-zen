// Zen Tab Suspender - Parked Page Controller
'use strict';

(function() {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Extract query parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const originalUrl = urlParams.get('url');
  const originalTitle = urlParams.get('title') || 'Suspended Tab';
  const originalFavicon = urlParams.get('favIconUrl');

  // Elements
  const faviconEl = document.getElementById('favicon');
  const titleEl = document.getElementById('title');
  const domainEl = document.getElementById('domain');
  const restoreBtn = document.getElementById('restore-btn');

  let restoreTriggered = false;

  // Helper to parse domain name
  function getDomain(url) {
    try {
      if (!url) return '';
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (e) {
      return '';
    }
  }

  // Restore the original tab URL
  function restoreTab() {
    if (restoreTriggered || !originalUrl) return;
    restoreTriggered = true;
    
    // Smooth button fade-out effect on click
    restoreBtn.style.opacity = '0.7';
    restoreBtn.querySelector('.btn-text').textContent = 'Restoring...';
    
    // Redirect directly to original URL
    window.location.replace(originalUrl);
  }

  // Populate visual elements
  function initPage() {
    // Page metadata
    document.title = `[Suspended] ${originalTitle}`;
    
    // Title
    titleEl.textContent = originalTitle;
    titleEl.title = originalTitle;
    
    // Domain
    domainEl.textContent = getDomain(originalUrl) || 'Unknown Site';
    
    // Favicon
    if (originalFavicon && originalFavicon !== 'undefined' && originalFavicon !== 'null') {
      faviconEl.src = originalFavicon;
    } else {
      faviconEl.src = 'icons/icon128.png'; // default fallback
    }

    // Set up default fallback if icon fails to load (e.g. cross-origin/corrupt URL)
    faviconEl.onerror = () => {
      faviconEl.src = 'icons/icon128.png';
    };

    // Attach Action Listeners
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent double triggering on document click
      restoreTab();
    });

    // Support quick click-anywhere to restore
    document.addEventListener('click', () => {
      restoreTab();
    });

    // Support keyboard shortcuts (Space / Enter)
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        restoreTab();
      }
    });

    // Listen for tab focus to support "auto-restore on focus" if desired in settings
    browserAPI.storage.local.get('settings').then((result) => {
      const settings = result.settings;
      if (settings && settings.autoRestoreTab) {
        window.addEventListener('focus', () => {
          restoreTab();
        });
      }
    }).catch(console.error);

    // Notify background script that this park page has finished rendering, 
    // so it can safely call browser.tabs.discard() to unload the process and reclaim memory.
    setTimeout(() => {
      browserAPI.runtime.sendMessage({ method: 'discardParkedTab' }).catch(console.error);
    }, 400);
  }

  // Run initialization
  if (originalUrl) {
    initPage();
  } else {
    // If opened directly without parameters, show generic screen
    titleEl.textContent = 'Zen Tab Suspender';
    domainEl.textContent = 'Active & Saving Memory';
    restoreBtn.style.display = 'none';
    document.querySelector('.footer-tip').textContent = 'Tabs will be listed here when suspended.';
  }
})();
