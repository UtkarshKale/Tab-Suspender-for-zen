// Zen Tab Suspender - Popup Script
'use strict';

(function() {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Master Power Elements
  const masterPowerBtn = document.getElementById('master-power-btn');
  const powerStatusTitle = document.getElementById('power-status-title');
  const powerStatusDesc = document.getElementById('power-status-desc');
  
  // Header Indicator Elements
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');

  // Slider Elements
  const timeoutSlider = document.getElementById('timeout-slider');
  const timeoutSliderDisplay = document.getElementById('timeout-slider-display');
  const popupSliderLeft = document.getElementById('popup-slider-left');
  const popupSliderRight = document.getElementById('popup-slider-right');

  // Pause elements
  const pauseCountdownPanel = document.getElementById('pause-countdown-panel');
  const countdownTimerText = document.getElementById('countdown-timer');
  const resumeCountdownBtn = document.getElementById('resume-countdown-btn');
  const quickPauseGrid = document.getElementById('quick-pause-grid');
  const pausePillBtns = document.querySelectorAll('.pause-pill-btn');
  
  // Action Buttons
  const suspendActiveBtn = document.getElementById('suspend-active-btn');
  const suspendOthersBtn = document.getElementById('suspend-others-btn');
  const unsuspendAllBtn = document.getElementById('unsuspend-all-btn');
  const whitelistBtn = document.getElementById('whitelist-btn');
  const settingsBtn = document.getElementById('settings-btn');

  // Timer intervals
  let countdownInterval = null;

  // Helper to format remaining milliseconds to HH:MM:SS
  function formatTimeRemaining(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  // Update Inactivity display text
  function updateSliderDisplay(val) {
    const minutes = parseInt(val);
    if (minutes < 60) {
      timeoutSliderDisplay.textContent = `${minutes} Minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        timeoutSliderDisplay.textContent = `${hours} Hour${hours > 1 ? 's' : ''}`;
      } else {
        timeoutSliderDisplay.textContent = `${hours} Hour${hours > 1 ? 's' : ''} ${remainingMinutes} Mins`;
      }
    }
  }

  // Manage dynamic countdown for active temporary pauses
  function runPauseCountdown(pausedUntilTime) {
    clearInterval(countdownInterval);

    const updateTimer = () => {
      const remainingMs = pausedUntilTime - Date.now();
      
      if (remainingMs <= 0) {
        clearInterval(countdownInterval);
        saveSettings({ pausedUntil: 0 }).then(() => {
          loadSettings();
        });
        return;
      }

      countdownTimerText.textContent = formatTimeRemaining(remainingMs);
    };

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
  }

  // Load and apply settings
  async function loadSettings() {
    clearInterval(countdownInterval);
    
    const result = await browserAPI.storage.local.get('settings');
    const settings = result.settings || { active: true, timeout: 30, pausedUntil: 0 };
    
    const isActive = settings.active;
    const pausedUntil = settings.pausedUntil || 0;
    const now = Date.now();
    const isCurrentlyPaused = pausedUntil > now;

    // 1. Sync Power Button states
    if (isActive) {
      masterPowerBtn.className = 'power-btn active';
      powerStatusTitle.textContent = 'Auto-Suspend Enabled';
      powerStatusDesc.textContent = 'Protecting your active browser RAM';
      
      // Update header indicator
      if (isCurrentlyPaused) {
        statusDot.className = 'status-dot paused';
        statusText.textContent = 'Paused';
        
        // Show Countdown view, hide Pills view
        pauseCountdownPanel.style.display = 'flex';
        quickPauseGrid.style.display = 'none';
        runPauseCountdown(pausedUntil);
      } else {
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Active';
        
        // Hide Countdown view, show Pills view
        pauseCountdownPanel.style.display = 'none';
        quickPauseGrid.style.display = 'flex';
      }
    } else {
      masterPowerBtn.className = 'power-btn disabled';
      powerStatusTitle.textContent = 'Auto-Suspend Disabled';
      powerStatusDesc.textContent = 'Auto-suspension is currently turned off';
      
      // Update header indicator
      statusDot.className = 'status-dot paused';
      statusText.textContent = 'Paused';
      
      // Hide both Pause sections if disabled
      pauseCountdownPanel.style.display = 'none';
      quickPauseGrid.style.display = 'none';
    }

    // 2. Sync Slider states
    timeoutSlider.value = settings.timeout || 30;
    updateSliderDisplay(timeoutSlider.value);
  }

  // Save Settings
  async function saveSettings(updates) {
    const result = await browserAPI.storage.local.get('settings');
    const settings = result.settings || {};
    const updatedSettings = { ...settings, ...updates };
    
    await browserAPI.storage.local.set({ settings: updatedSettings });
    
    // Notify background page to update alarms
    browserAPI.runtime.sendMessage({ method: 'settingsChanged', settings: updatedSettings }).catch(console.error);
  }

  // Bind Event UI Interactions
  function initEvents() {
    // 1. Power switch toggling
    masterPowerBtn.addEventListener('click', async () => {
      const result = await browserAPI.storage.local.get('settings');
      const settings = result.settings || {};
      const active = !settings.active;
      
      // Toggle off active state resets any active temporary pauses
      await saveSettings({ active, pausedUntil: 0 });
      loadSettings();
    });

    // 2. Slider drag triggers
    timeoutSlider.addEventListener('input', (e) => {
      updateSliderDisplay(e.target.value);
    });

    timeoutSlider.addEventListener('change', (e) => {
      saveSettings({ timeout: parseInt(e.target.value) });
    });

    // Slider chevrons buttons click
    popupSliderLeft.addEventListener('click', () => {
      let val = parseInt(timeoutSlider.value) - 5;
      if (val < 5) val = 5;
      timeoutSlider.value = val;
      updateSliderDisplay(val);
      saveSettings({ timeout: val });
    });

    popupSliderRight.addEventListener('click', () => {
      let val = parseInt(timeoutSlider.value) + 5;
      if (val > 300) val = 300;
      timeoutSlider.value = val;
      updateSliderDisplay(val);
      saveSettings({ timeout: val });
    });

    // 3. Temporary Pause Quick Pills
    pausePillBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const pauseMinutes = parseInt(btn.getAttribute('data-pause'));
        const futureTimestamp = Date.now() + pauseMinutes * 60 * 1000;
        
        // Enabling temporary pause automatically ensures extension auto-suspend is enabled
        await saveSettings({ active: true, pausedUntil: futureTimestamp });
        loadSettings();
      });
    });

    // 4. Resume Button override
    resumeCountdownBtn.addEventListener('click', async () => {
      await saveSettings({ pausedUntil: 0 });
      loadSettings();
    });

    // 5. Suspend Current Tab
    suspendActiveBtn.addEventListener('click', async () => {
      const [currentTab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (currentTab && !currentTab.url.startsWith('about:') && !currentTab.url.startsWith('moz-extension:')) {
        // Log tab in history
        await browserAPI.runtime.sendMessage({ method: 'manualSuspend', tab: currentTab }).catch(console.error);

        const parkUrl = browserAPI.runtime.getURL(
          `park.html?url=${encodeURIComponent(currentTab.url)}&title=${encodeURIComponent(currentTab.title || '')}&favIconUrl=${encodeURIComponent(currentTab.favIconUrl || '')}`
        );
        await browserAPI.tabs.update(currentTab.id, { url: parkUrl }).catch(console.error);
        window.close(); // Close popup
      }
    });

    // 6. Suspend Other Tabs
    suspendOthersBtn.addEventListener('click', async () => {
      const otherTabs = await browserAPI.tabs.query({ active: false, currentWindow: true });
      const result = await browserAPI.storage.local.get('settings');
      const settings = result.settings || {};
      
      for (const tab of otherTabs) {
        if (tab.url.startsWith('about:') || tab.url.startsWith('moz-extension:')) continue;
        
        // Exclude pinned or playing audio depending on options
        if (settings.preventPinned && tab.pinned) continue;
        if (settings.preventAudio && tab.audible) continue;
        
        // Log manual suspension to history
        await browserAPI.runtime.sendMessage({ method: 'manualSuspend', tab: tab }).catch(console.error);

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

    // 7. Unsuspend All Tabs in Current Window
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

    // 8. Whitelist Current Domain
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

    // 9. Open Dashboard settings
    settingsBtn.addEventListener('click', () => {
      browserAPI.tabs.create({ url: browserAPI.runtime.getURL('options.html') });
      window.close();
    });
  }

  // Initial load
  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initEvents();
  });
})();
