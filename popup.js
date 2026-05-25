// Zen Tab Suspender - Popup Script
'use strict';

(function() {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // UI Elements
  const masterToggle = document.getElementById('master-toggle');
  const timeoutSelect = document.getElementById('timeout-select');
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');
  
  // Action Buttons
  const suspendActiveBtn = document.getElementById('suspend-active-btn');
  const suspendOthersBtn = document.getElementById('suspend-others-btn');
  const unsuspendAllBtn = document.getElementById('unsuspend-all-btn');
  const whitelistBtn = document.getElementById('whitelist-btn');
  const settingsBtn = document.getElementById('settings-btn');

  // Load and apply current settings
  async function loadSettings() {
    const result = await browserAPI.storage.local.get('settings');
    const settings = result.settings || { active: true, timeout: 30 };
    
    // Update master toggle state
    masterToggle.checked = settings.active;
    
    // Update timeout selector
    timeoutSelect.value = settings.timeout;
    
    // Update visual status header
    updateStatusVisuals(settings.active);
  }

  // Update Status visuals
  function updateStatusVisuals(isActive) {
    if (isActive) {
      statusDot.className = 'status-dot active';
      statusText.textContent = 'Active';
    } else {
      statusDot.className = 'status-dot paused';
      statusText.textContent = 'Paused';
    }
  }

  // Save modified settings
  async function saveSettings(updates) {
    const result = await browserAPI.storage.local.get('settings');
    const settings = result.settings || {};
    const updatedSettings = { ...settings, ...updates };
    
    await browserAPI.storage.local.set({ settings: updatedSettings });
    
    // Notify background page to update alarms
    browserAPI.runtime.sendMessage({ method: 'settingsChanged', settings: updatedSettings }).catch(console.error);
  }

  // Set up UI Event Listeners
  function initEvents() {
    // 1. Toggle master switch
    masterToggle.addEventListener('change', (e) => {
      const active = e.target.checked;
      updateStatusVisuals(active);
      saveSettings({ active });
    });

    // 2. Select inactivity timeout
    timeoutSelect.addEventListener('change', (e) => {
      const timeout = parseInt(e.target.value);
      saveSettings({ timeout });
    });

    // 3. Suspend Current Tab
    suspendActiveBtn.addEventListener('click', async () => {
      const [currentTab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (currentTab && !currentTab.url.startsWith('about:') && !currentTab.url.startsWith('moz-extension:')) {
        const parkUrl = browserAPI.runtime.getURL(
          `park.html?url=${encodeURIComponent(currentTab.url)}&title=${encodeURIComponent(currentTab.title || '')}&favIconUrl=${encodeURIComponent(currentTab.favIconUrl || '')}`
        );
        await browserAPI.tabs.update(currentTab.id, { url: parkUrl }).catch(console.error);
        window.close(); // Close popup
      }
    });

    // 4. Suspend Other Tabs
    suspendOthersBtn.addEventListener('click', async () => {
      const [currentTab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      const otherTabs = await browserAPI.tabs.query({ active: false, currentWindow: true });
      
      const result = await browserAPI.storage.local.get('settings');
      const settings = result.settings || {};
      
      // Notify background to run checks on each background tab immediately
      for (const tab of otherTabs) {
        // Exclude internal/browser pages
        if (tab.url.startsWith('about:') || tab.url.startsWith('moz-extension:')) continue;
        
        // Skip audio, whitelisted, or pinned depending on settings
        if (settings.preventPinned && tab.pinned) continue;
        if (settings.preventAudio && tab.audible) continue;
        
        const parkUrl = browserAPI.runtime.getURL(
          `park.html?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title || '')}&favIconUrl=${encodeURIComponent(tab.favIconUrl || '')}`
        );
        
        if (settings.mode === 'silent') {
          await browserAPI.tabs.discard(tab.id).catch(console.error);
        } else {
          await browserAPI.tabs.update(tab.id, { url: parkUrl }).catch(console.error);
        }
      }
      window.close();
    });

    // 5. Unsuspend All Tabs in Current Window
    unsuspendAllBtn.addEventListener('click', async () => {
      const tabs = await browserAPI.tabs.query({ currentWindow: true });
      for (const tab of tabs) {
        if (tab.url.startsWith(browserAPI.runtime.getURL('park.html'))) {
          try {
            const urlObj = new URL(tab.url);
            const originalUrl = urlObj.searchParams.get('url');
            if (originalUrl) {
              await browserAPI.tabs.update(tab.id, { url: originalUrl }).catch(console.error);
            }
          } catch (e) {
            console.error('Failed to parse parked tab URL during unsuspend all:', e);
          }
        }
      }
      window.close();
    });

    // 6. Whitelist Current Domain
    whitelistBtn.addEventListener('click', async () => {
      const [currentTab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (currentTab && currentTab.url && !currentTab.url.startsWith('about:') && !currentTab.url.startsWith('moz-extension:')) {
        try {
          const urlObj = new URL(currentTab.url);
          const domainPattern = `*${urlObj.hostname}*`;
          
          const result = await browserAPI.storage.local.get('settings');
          const settings = result.settings || {};
          const whitelist = settings.whitelist || [];
          
          if (!whitelist.includes(domainPattern)) {
            whitelist.push(domainPattern);
            await saveSettings({ whitelist });
            
            // Temporary UI feedback
            whitelistBtn.textContent = 'Whitelisted!';
            whitelistBtn.style.borderColor = '#10b981';
            whitelistBtn.style.color = '#10b981';
            setTimeout(() => {
              window.close();
            }, 1000);
          } else {
            whitelistBtn.textContent = 'Already Whitelisted';
            setTimeout(() => {
              window.close();
            }, 1000);
          }
        } catch (e) {
          console.error('Failed to whitelist domain:', e);
        }
      }
    });

    // 7. Open Dashboard Options
    settingsBtn.addEventListener('click', () => {
      browserAPI.tabs.create({ url: browserAPI.runtime.getURL('options.html') });
      window.close();
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initEvents();
  });
})();
