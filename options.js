// Zen Tab Suspender - Options Dashboard Script
'use strict';

(function() {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Tab Navigation Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // General Settings Elements
  const activeCheck = document.getElementById('setting-active');
  const timeoutSelect = document.getElementById('setting-timeout'); // range slider input
  const modeRadios = document.getElementsByName('setting-mode');
  
  // Custom Slider Elements
  const sliderTimeoutVal = document.getElementById('slider-timeout-value');
  const sliderArrowLeft = document.getElementById('slider-arrow-left');
  const sliderArrowRight = document.getElementById('slider-arrow-right');

  // Whitelist Elements
  const whitelistInput = document.getElementById('whitelist-input');
  const addWhitelistBtn = document.getElementById('add-whitelist-btn');
  const whitelistList = document.getElementById('whitelist-list');

  // Advanced Exclusions Elements
  const preventAudioCheck = document.getElementById('setting-prevent-audio');
  const preventPinnedCheck = document.getElementById('setting-prevent-pinned');
  const preventFormsCheck = document.getElementById('setting-prevent-forms');
  const autoRestoreCheck = document.getElementById('setting-auto-restore');

  // Suspension History Elements
  const historySearchInput = document.getElementById('history-search-input');
  const historyGrid = document.getElementById('suspended-history-grid');
  const ramSavedEl = document.getElementById('history-ram-saved');
  const totalSuspendedEl = document.getElementById('history-total-suspended');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const exportHistoryBtn = document.getElementById('export-history-btn');

  // Notification Toast
  const toastNotify = document.getElementById('toast-notify');
  let toastTimer;

  // Active states
  let currentSettings = {};
  let fullHistoryList = [];

  // 1. Sidebar Tab Navigation Logic
  function initNavigation() {
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTab = item.getAttribute('data-tab');

        // Toggle nav items active class
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Toggle panel active class
        tabPanels.forEach(panel => {
          if (panel.id === `tab-${targetTab}`) {
            panel.classList.add('active');
            // Lazy load history when tab is clicked
            if (targetTab === 'history') {
              loadHistory();
            }
          } else {
            panel.classList.remove('active');
          }
        });
      });
    });

    // Check if redirecting from popup history link via URL search param
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab');
    if (targetTab === 'history') {
      const historyNavItem = document.querySelector('.nav-item[data-tab="history"]');
      if (historyNavItem) {
        // Toggle nav items active class
        navItems.forEach(nav => nav.classList.remove('active'));
        historyNavItem.classList.add('active');

        // Toggle panel active class
        tabPanels.forEach(panel => {
          if (panel.id === 'tab-history') {
            panel.classList.add('active');
            loadHistory();
          } else {
            panel.classList.remove('active');
          }
        });
      }
    }
  }

  // Show sliding notification toast
  function showToast(message = 'Settings Saved Successfully') {
    toastNotify.textContent = message;
    toastNotify.classList.add('show');
    
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotify.classList.remove('show');
    }, 2500);
  }

  // Formatting Timeouts Helper
  function updateTimeoutDisplay(val) {
    const minutes = parseInt(val);
    if (minutes < 60) {
      sliderTimeoutVal.textContent = `${minutes} Minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        sliderTimeoutVal.textContent = `${hours} Hour${hours > 1 ? 's' : ''}`;
      } else {
        sliderTimeoutVal.textContent = `${hours} Hour${hours > 1 ? 's' : ''} ${remainingMinutes} Mins`;
      }
    }
  }

  // 2. Load Saved Settings
  async function loadSettings() {
    const result = await browserAPI.storage.local.get('settings');
    currentSettings = result.settings || {};

    // General Controls
    activeCheck.checked = currentSettings.active !== undefined ? currentSettings.active : true;
    
    const timeoutVal = currentSettings.timeout || 30;
    timeoutSelect.value = timeoutVal;
    updateTimeoutDisplay(timeoutVal);
    
    const mode = currentSettings.mode || 'visual';
    for (const radio of modeRadios) {
      radio.checked = radio.value === mode;
    }

    // Advanced Controls
    preventAudioCheck.checked = currentSettings.preventAudio !== undefined ? currentSettings.preventAudio : true;
    preventPinnedCheck.checked = currentSettings.preventPinned !== undefined ? currentSettings.preventPinned : true;
    preventFormsCheck.checked = currentSettings.preventForms !== undefined ? currentSettings.preventForms : true;
    autoRestoreCheck.checked = currentSettings.autoRestoreTab !== undefined ? currentSettings.autoRestoreTab : false;

    // Render Whitelist Grid
    renderWhitelist(currentSettings.whitelist || []);
  }

  // 3. Save Settings dynamically
  async function saveSettings(updates) {
    currentSettings = { ...currentSettings, ...updates };
    await browserAPI.storage.local.set({ settings: currentSettings });
    
    // Notify background script to refresh alarms/checks
    browserAPI.runtime.sendMessage({ method: 'settingsChanged', settings: currentSettings }).catch(console.error);
    showToast();
  }

  // Bind settings saving to form field interactions
  function initSettingsBindings() {
    // Master switch auto-suspension
    activeCheck.addEventListener('change', (e) => {
      saveSettings({ active: e.target.checked });
    });

    // Inactivity timeout duration range input
    timeoutSelect.addEventListener('input', (e) => {
      updateTimeoutDisplay(e.target.value);
    });
    
    timeoutSelect.addEventListener('change', (e) => {
      saveSettings({ timeout: parseInt(e.target.value) });
    });

    // Flanking arrows for time adjustment
    sliderArrowLeft.addEventListener('click', () => {
      let val = parseInt(timeoutSelect.value) - 5;
      if (val < 5) val = 5;
      timeoutSelect.value = val;
      updateTimeoutDisplay(val);
      saveSettings({ timeout: val });
    });

    sliderArrowRight.addEventListener('click', () => {
      let val = parseInt(timeoutSelect.value) + 5;
      if (val > 300) val = 300;
      timeoutSelect.value = val;
      updateTimeoutDisplay(val);
      saveSettings({ timeout: val });
    });

    // Suspension mode radios
    for (const radio of modeRadios) {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          saveSettings({ mode: e.target.value });
        }
      });
    }

    // Advanced exclusions checks
    preventAudioCheck.addEventListener('change', (e) => {
      saveSettings({ preventAudio: e.target.checked });
    });

    preventPinnedCheck.addEventListener('change', (e) => {
      saveSettings({ preventPinned: e.target.checked });
    });

    preventFormsCheck.addEventListener('change', (e) => {
      saveSettings({ preventForms: e.target.checked });
    });

    autoRestoreCheck.addEventListener('change', (e) => {
      saveSettings({ autoRestoreTab: e.target.checked });
    });
  }

  // 4. Render Whitelist Cards
  function renderWhitelist(whitelist) {
    whitelistList.innerHTML = '';
    
    if (whitelist.length === 0) {
      whitelistList.innerHTML = `
        <div class="setting-info" style="grid-column: 1 / -1; text-align: center; padding: 20px; opacity: 0.5;">
          <p>No whitelisted domains yet. Add domains above to protect them.</p>
        </div>
      `;
      return;
    }

    whitelist.forEach((pattern, index) => {
      const item = document.createElement('div');
      item.className = 'whitelist-item glass-panel';
      
      const patternText = document.createElement('span');
      patternText.className = 'whitelist-pattern';
      patternText.textContent = pattern;
      patternText.title = pattern;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-whitelist-btn';
      removeBtn.title = 'Remove whitelist pattern';
      removeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;
      
      removeBtn.addEventListener('click', () => {
        const updatedWhitelist = whitelist.filter((_, i) => i !== index);
        saveSettings({ whitelist: updatedWhitelist });
        renderWhitelist(updatedWhitelist);
      });
      
      item.appendChild(patternText);
      item.appendChild(removeBtn);
      whitelistList.appendChild(item);
    });
  }

  // 5. Add items to whitelist array
  function handleAddWhitelist() {
    const value = whitelistInput.value.trim();
    if (!value) return;

    const whitelist = currentSettings.whitelist || [];
    if (!whitelist.includes(value)) {
      const updatedWhitelist = [...whitelist, value];
      saveSettings({ whitelist: updatedWhitelist });
      renderWhitelist(updatedWhitelist);
      whitelistInput.value = '';
    } else {
      showToast('Domain already in whitelist!');
    }
  }

  function initWhitelistBindings() {
    addWhitelistBtn.addEventListener('click', handleAddWhitelist);
    whitelistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleAddWhitelist();
      }
    });
  }

  // 6. Suspended History Management
  async function loadHistory() {
    const result = await browserAPI.storage.local.get('history');
    fullHistoryList = result.history || [];
    renderHistory(fullHistoryList);
  }

  // Helper: Relative time since suspension
  function getRelativeTime(timestamp) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - timestamp) / 1000);
    
    if (elapsedSeconds < 60) return 'Just now';
    
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays === 1) return 'Yesterday';
    return `${elapsedDays} days ago`;
  }

  // Helper: extract root hostname domain
  function getDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (e) {
      return 'Unknown';
    }
  }

  // Render History Items with optional search filter
  function renderHistory(historyData, filterQuery = '') {
    historyGrid.innerHTML = '';
    
    // Filter items based on query
    const filteredData = historyData.filter(item => {
      const title = (item.title || '').toLowerCase();
      const url = (item.url || '').toLowerCase();
      const search = filterQuery.toLowerCase();
      return title.includes(search) || url.includes(search);
    });

    // Update Widgets Dashboard
    totalSuspendedEl.textContent = historyData.length;
    
    // Sum estimated saved RAM based on precise profiling metrics
    let totalSavedBytes = 0;
    historyData.forEach(item => {
      totalSavedBytes += item.memoryReclaimedBytes || (85 * 1024 * 1024); // Fallback to 85MB
    });

    const ramMB = Math.floor(totalSavedBytes / (1024 * 1024));
    if (ramMB < 1024) {
      ramSavedEl.textContent = `${ramMB} MB`;
    } else {
      const ramGB = (ramMB / 1024).toFixed(1);
      ramSavedEl.textContent = `${ramGB} GB`;
    }

    if (filteredData.length === 0) {
      historyGrid.innerHTML = `
        <div class="setting-info" style="text-align: center; padding: 40px; opacity: 0.5;">
          <p>${filterQuery ? 'No history entries match your search.' : 'Your suspension history is empty. Inactive tabs will populate here once suspended.'}</p>
        </div>
      `;
      return;
    }

    filteredData.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'history-card glass-panel';

      const left = document.createElement('div');
      left.className = 'history-card-left';

      // Favicon icon
      const favicon = document.createElement('img');
      favicon.className = 'history-card-favicon';
      if (item.favIconUrl && item.favIconUrl !== 'undefined') {
        favicon.src = item.favIconUrl;
      } else {
        favicon.src = 'icons/icon128.png';
      }
      favicon.onerror = () => {
        favicon.src = 'icons/icon128.png';
      };

      const info = document.createElement('div');
      info.className = 'history-card-info';

      const title = document.createElement('span');
      title.className = 'history-card-title';
      title.textContent = item.title;
      title.title = item.title;

      const meta = document.createElement('div');
      meta.className = 'history-card-meta';
      
      const domain = document.createElement('span');
      domain.className = 'history-card-domain';
      domain.textContent = getDomain(item.url);

      const dot = document.createElement('span');
      dot.className = 'history-card-dot';

      const timeText = document.createElement('span');
      timeText.textContent = getRelativeTime(item.suspendedAt);

      meta.appendChild(domain);
      meta.appendChild(dot);
      meta.appendChild(timeText);

      info.appendChild(title);
      info.appendChild(meta);

      left.appendChild(favicon);
      left.appendChild(info);

      const right = document.createElement('div');
      right.className = 'history-card-right';

      // Memory Reclamation Badge (specific to this tab)
      const reclaimedBytes = item.memoryReclaimedBytes || (85 * 1024 * 1024);
      const reclaimedMB = Math.floor(reclaimedBytes / (1024 * 1024));
      
      const memoryBadge = document.createElement('span');
      memoryBadge.className = 'history-card-ram-badge';
      memoryBadge.textContent = `${reclaimedMB} MB Saved`;

      // Restore button (opens the original tab)
      const restoreLink = document.createElement('a');
      restoreLink.className = 'history-restore-link';
      restoreLink.textContent = 'Restore Tab';
      restoreLink.title = `Click to restore ${item.url}`;
      restoreLink.addEventListener('click', () => {
        browserAPI.tabs.create({ url: item.url });
      });

      // Individual item delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'history-card-delete';
      deleteBtn.title = 'Remove this entry from log';
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;

      deleteBtn.addEventListener('click', async () => {
        // Find index of matching item in full list
        const realIndex = fullHistoryList.findIndex(h => h.id === item.id);
        if (realIndex !== -1) {
          fullHistoryList.splice(realIndex, 1);
          await browserAPI.storage.local.set({ history: fullHistoryList });
          renderHistory(fullHistoryList, historySearchInput.value);
          showToast('Entry Removed from History');
        }
      });

      right.appendChild(memoryBadge);
      right.appendChild(restoreLink);
      right.appendChild(deleteBtn);

      card.appendChild(left);
      card.appendChild(right);

      historyGrid.appendChild(card);
    });
  }

  // Bind History Panel Triggers
  function initHistoryBindings() {
    // 1. Search filter input
    historySearchInput.addEventListener('input', (e) => {
      renderHistory(fullHistoryList, e.target.value);
    });

    // 2. Clear all history items
    clearHistoryBtn.addEventListener('click', async () => {
      if (fullHistoryList.length === 0) return;
      
      const confirmClear = confirm('Are you sure you want to clear your suspension history log? (This will not close or restore your active browser tabs)');
      if (confirmClear) {
        fullHistoryList = [];
        await browserAPI.storage.local.set({ history: [] });
        renderHistory([]);
        showToast('History Log Cleared');
      }
    });

    // 3. Export History Backup (data persistence safeguard)
    exportHistoryBtn.addEventListener('click', () => {
      if (fullHistoryList.length === 0) {
        alert('Your history log is currently empty. There are no tabs to export.');
        return;
      }

      try {
        const timestamp = new Date().toLocaleString();
        let totalSavedBytes = 0;
        fullHistoryList.forEach(item => {
          totalSavedBytes += item.memoryReclaimedBytes || (85 * 1024 * 1024);
        });
        const ramMB = Math.floor(totalSavedBytes / (1024 * 1024));
        const ramStr = ramMB < 1024 ? `${ramMB} MB` : `${(ramMB / 1024).toFixed(1)} GB`;

        let backupContent = `# Zen Tab Suspender Backup\n`;
        backupContent += `Exported on: ${timestamp}\n`;
        backupContent += `Total Suspended Tabs: ${fullHistoryList.length}\n`;
        backupContent += `Estimated Memory Reclaimed: ${ramStr}\n\n`;
        backupContent += `## Suspended Pages Index:\n`;

        fullHistoryList.forEach((item, index) => {
          const dateStr = new Date(item.suspendedAt).toLocaleString();
          const bytes = item.memoryReclaimedBytes || (85 * 1024 * 1024);
          const mb = Math.floor(bytes / (1024 * 1024));
          backupContent += `${index + 1}. [${item.title}](${item.url}) - ${mb}MB saved - Suspended on ${dateStr}\n`;
        });

        // Trigger local file download
        const blob = new Blob([backupContent], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Dynamic file name
        const cleanDate = new Date().toISOString().slice(0,10);
        link.setAttribute('download', `zen_suspended_tabs_backup_${cleanDate}.md`);
        document.body.appendChild(link);
        link.click();
        
        // Cleanup DOM
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Backup File Downloaded!');
      } catch (e) {
        console.error('Failed to export suspension history:', e);
        alert('An error occurred during the backup generation. Please try again.');
      }
    });
  }

  // Handle storage updates in real time
  browserAPI.runtime.onMessage.addListener((message) => {
    if (message.method === 'historyUpdated') {
      fullHistoryList = message.history || [];
      const currentTab = document.querySelector('.nav-item.active').getAttribute('data-tab');
      if (currentTab === 'history') {
        renderHistory(fullHistoryList, historySearchInput.value);
      }
    }
  });

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadSettings();
    initSettingsBindings();
    initWhitelistBindings();
    initHistoryBindings();
  });
})();
