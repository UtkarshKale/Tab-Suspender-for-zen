// Zen Tab Suspender - Options Dashboard Script
'use strict';

(function() {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Tab Navigation Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // General Settings Elements
  const activeCheck = document.getElementById('setting-active');
  const timeoutSelect = document.getElementById('setting-timeout');
  const modeRadios = document.getElementsByName('setting-mode');

  // Whitelist Elements
  const whitelistInput = document.getElementById('whitelist-input');
  const addWhitelistBtn = document.getElementById('add-whitelist-btn');
  const whitelistList = document.getElementById('whitelist-list');

  // Advanced Exclusions Elements
  const preventAudioCheck = document.getElementById('setting-prevent-audio');
  const preventPinnedCheck = document.getElementById('setting-prevent-pinned');
  const preventFormsCheck = document.getElementById('setting-prevent-forms');
  const autoRestoreCheck = document.getElementById('setting-auto-restore');

  // Notification Toast
  const toastNotify = document.getElementById('toast-notify');
  let toastTimer;

  // Active settings state
  let currentSettings = {};

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
          } else {
            panel.classList.remove('active');
          }
        });
      });
    });
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

  // 2. Load Saved Settings
  async function loadSettings() {
    const result = await browserAPI.storage.local.get('settings');
    currentSettings = result.settings || {};

    // General Controls
    activeCheck.checked = currentSettings.active !== undefined ? currentSettings.active : true;
    timeoutSelect.value = currentSettings.timeout || '30';
    
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

    // Inactivity timeout duration
    timeoutSelect.addEventListener('change', (e) => {
      saveSettings({ timeout: parseInt(e.target.value) });
    });

    // Suspension mode radios
    for (const radio of modeRadios) {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          saveSettings({ mode: e.target.value });
        }
      });
    }

    // Audible exclusion
    preventAudioCheck.addEventListener('change', (e) => {
      saveSettings({ preventAudio: e.target.checked });
    });

    // Pinned exclusion
    preventPinnedCheck.addEventListener('change', (e) => {
      saveSettings({ preventPinned: e.target.checked });
    });

    // Form inputs exclusion
    preventFormsCheck.addEventListener('change', (e) => {
      saveSettings({ preventForms: e.target.checked });
    });

    // Auto-restore tab on focus option
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
    // Button click
    addWhitelistBtn.addEventListener('click', handleAddWhitelist);

    // Enter key press in input
    whitelistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleAddWhitelist();
      }
    });
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadSettings();
    initSettingsBindings();
    initWhitelistBindings();
  });
})();
