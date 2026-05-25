// Zen Tab Suspender - Background Script
// Native WebExtensions MV3 implementation for Firefox / Zen Browser
'use strict';

// Unified browser API object for compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Default Settings
const DEFAULT_SETTINGS = {
  active: true,
  timeout: 30, // 30 minutes
  mode: 'visual', // 'visual' (park.html + discard) or 'silent' (native discard)
  preventAudio: true,
  preventPinned: true,
  preventForms: true,
  pausedUntil: 0, // Timestamp when pause expires (0 = not paused)
  whitelist: [
    '*mail.google.com*',
    '*outlook.live.com*',
    '*youtube.com/watch*',
    '*spotify.com*'
  ]
};

// In-memory runtime states (non-persistent, cleared on background reload)
const activeFormTabs = new Set(); // Stores tabIds that have active unsaved forms

// Initialize Settings in Extension Storage
async function getSettings() {
  const result = await browserAPI.storage.local.get('settings');
  if (!result.settings) {
    await browserAPI.storage.local.set({ settings: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  }
  // Merge default settings to ensure new features are present
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

// Helper to convert wildcard expression to RegExp
function wildcardToRegExp(wildcard) {
  const escaped = wildcard.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexString = '^' + escaped.replace(/\*/g, '.*') + '$';
  return new RegExp(regexString, 'i');
}

// Check if tab matches whitelist pattern
function isWhitelisted(url, whitelist) {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;
    
    return whitelist.some(pattern => {
      // Simple domain match
      if (pattern.indexOf('*') === -1) {
        return host === pattern || host.endsWith('.' + pattern);
      }
      // Wildcard match
      const regex = wildcardToRegExp(pattern);
      return regex.test(url) || regex.test(host);
    });
  } catch (e) {
    console.error('Failed to parse URL for whitelist check:', url, e);
    return false;
  }
}

// Add a tab to suspension history
async function addToHistory(tab) {
  try {
    const result = await browserAPI.storage.local.get('history');
    const history = result.history || [];
    
    // Create new history item
    const newItem = {
      id: `${tab.url}_${Date.now()}`,
      url: tab.url,
      title: tab.title || 'Suspended Tab',
      favIconUrl: tab.favIconUrl || '',
      suspendedAt: Date.now()
    };
    
    // Add to top of list
    history.unshift(newItem);
    
    // Cap history list at 200 to save memory & storage limits
    const cappedHistory = history.slice(0, 200);
    
    await browserAPI.storage.local.set({ history: cappedHistory });
    
    // Notify options/popup page if open
    browserAPI.runtime.sendMessage({ method: 'historyUpdated', history: cappedHistory }).catch(() => {
      // Ignore error if page is closed
    });
  } catch (e) {
    console.error('Failed to save tab in history:', e);
  }
}

// Core function to check if a tab is eligible for suspension
async function checkAndSuspendTab(tab, settings) {
  if (!settings.active) return;
  
  // Pause status check
  if (settings.pausedUntil && Date.now() < settings.pausedUntil) {
    return;
  }
  
  // Never suspend active tabs, extension pages, or invalid URLs
  if (tab.active) return;
  if (!tab.url) return;
  if (tab.url.startsWith('about:') || tab.url.startsWith('chrome:') || tab.url.startsWith('moz-extension:') || tab.url.startsWith('chrome-extension:')) {
    return;
  }
  
  // Pinned tab protection
  if (settings.preventPinned && tab.pinned) {
    return;
  }
  
  // Audio playing protection
  if (settings.preventAudio && tab.audible) {
    return;
  }
  
  // Whitelist protection
  if (isWhitelisted(tab.url, settings.whitelist)) {
    return;
  }
  
  // Active Form typing protection
  if (settings.preventForms && activeFormTabs.has(tab.id)) {
    return;
  }
  
  // Perform suspension
  console.log(`Suspending tab ${tab.id}: ${tab.title} (${tab.url})`);
  
  // Add to suspension history
  await addToHistory(tab);
  
  if (settings.mode === 'silent') {
    // Native Silent mode - discard the tab directly
    await browserAPI.tabs.discard(tab.id).catch(console.error);
  } else {
    // Visual mode - redirect to parked page first
    const parkUrl = browserAPI.runtime.getURL(
      `park.html?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title || '')}&favIconUrl=${encodeURIComponent(tab.favIconUrl || '')}`
    );
    await browserAPI.tabs.update(tab.id, { url: parkUrl }).catch(console.error);
  }
}

// Orchestrator: Check all background tabs for inactivity
async function checkAllTabs() {
  const settings = await getSettings();
  if (!settings.active) return;
  
  // Pause status check
  if (settings.pausedUntil && Date.now() < settings.pausedUntil) {
    return;
  }

  const now = Date.now();
  const idleTimeoutMs = settings.timeout * 60 * 1000;
  
  const tabs = await browserAPI.tabs.query({ active: false });
  
  for (const tab of tabs) {
    // Use browser-provided lastAccessed property
    const lastAccessed = tab.lastAccessed || now;
    const idleTime = now - lastAccessed;
    
    if (idleTime >= idleTimeoutMs) {
      await checkAndSuspendTab(tab, settings);
    }
  }
}

// Setup Firefox alarms for periodic execution
function setupAlarm(intervalMinutes) {
  browserAPI.alarms.clear('checkIdleTabs');
  browserAPI.alarms.create('checkIdleTabs', {
    periodInMinutes: 1 // check every minute for high responsiveness
  });
}

// Context Menus Initialization
function createContextMenus() {
  browserAPI.contextMenus.removeAll(() => {
    browserAPI.contextMenus.create({
      id: 'suspend-current',
      title: 'Suspend this tab',
      contexts: ['action', 'page']
    });
    browserAPI.contextMenus.create({
      id: 'suspend-others',
      title: 'Suspend other tabs in this window',
      contexts: ['action', 'page']
    });
    browserAPI.contextMenus.create({
      id: 'whitelist-current',
      title: 'Never suspend this site',
      contexts: ['action', 'page']
    });
  });
}

// Context Menu Action Handler
browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
  const settings = await getSettings();
  
  if (info.menuItemId === 'suspend-current') {
    if (tab) {
      // Temporarily bypass active status constraint for manual request
      await browserAPI.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        // Suspending current tab requires visual mode, otherwise native discard will unload active tab (not standard)
        await addToHistory(tab);
        const parkUrl = browserAPI.runtime.getURL(
          `park.html?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title || '')}&favIconUrl=${encodeURIComponent(tab.favIconUrl || '')}`
        );
        await browserAPI.tabs.update(tab.id, { url: parkUrl }).catch(console.error);
      });
    }
  } else if (info.menuItemId === 'suspend-others') {
    if (tab) {
      const windowTabs = await browserAPI.tabs.query({ windowId: tab.windowId, active: false });
      for (const t of windowTabs) {
        await checkAndSuspendTab(t, settings);
      }
    }
  } else if (info.menuItemId === 'whitelist-current') {
    if (tab && tab.url) {
      try {
        const urlObj = new URL(tab.url);
        const domainPattern = `*${urlObj.hostname}*`;
        
        if (!settings.whitelist.includes(domainPattern)) {
          settings.whitelist.push(domainPattern);
          await browserAPI.storage.local.set({ settings });
          console.log(`Whitelisted domain: ${domainPattern}`);
          
          // Notify any open options or popups to refresh
          browserAPI.runtime.sendMessage({ method: 'settingsChanged', settings });
        }
      } catch (e) {
        console.error('Failed to whitelist current domain:', e);
      }
    }
  }
});

// Listener: Firefox Alarms
browserAPI.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkIdleTabs') {
    checkAllTabs();
  }
});

// Listener: Messaging between Content scripts, Options, Popup, and Background
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.method === 'markFormActive') {
    if (sender.tab && sender.tab.id) {
      activeFormTabs.add(sender.tab.id);
      console.log(`Tab ${sender.tab.id} marked as ACTIVE FORM (preventing suspension)`);
    }
  } 
  else if (message.method === 'markFormInactive') {
    if (sender.tab && sender.tab.id) {
      activeFormTabs.delete(sender.tab.id);
      console.log(`Tab ${sender.tab.id} marked as INACTIVE FORM`);
    }
  } 
  else if (message.method === 'discardParkedTab') {
    // When a visual park page completes rendering, discard it to reclaim 100% memory
    if (sender.tab && sender.tab.id) {
      console.log(`Discarding parked tab ${sender.tab.id} to reclaim memory`);
      setTimeout(() => {
        browserAPI.tabs.discard(sender.tab.id).catch(console.error);
      }, 500); // Small delay to let page stabilize
    }
  }
  else if (message.method === 'manualSuspend') {
    if (message.tab) {
      addToHistory(message.tab);
    }
  }
  else if (message.method === 'unsuspendTab') {
    if (message.tabId) {
      // Programmatically unsuspend a specific tab
      browserAPI.tabs.get(message.tabId).then(tab => {
        if (tab.url.startsWith(browserAPI.runtime.getURL('park.html'))) {
          try {
            const urlObj = new URL(tab.url);
            const originalUrl = urlObj.searchParams.get('url');
            if (originalUrl) {
              browserAPI.tabs.update(tab.id, { url: originalUrl });
            }
          } catch (e) {
            console.error('Failed to parse parked URL:', e);
          }
        }
      }).catch(console.error);
    }
  }
  else if (message.method === 'settingsChanged') {
    // Re-initialize timeout alarms if settings are changed
    setupAlarm();
  }
});

// Clean up form statuses on tab close or navigation
browserAPI.tabs.onRemoved.addListener((tabId) => {
  activeFormTabs.delete(tabId);
});

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    activeFormTabs.delete(tabId);
  }
});

// Initialization
browserAPI.runtime.onInstalled.addListener(() => {
  console.log('Zen Tab Suspender installed.');
  getSettings().then(() => {
    setupAlarm();
    createContextMenus();
  });
});

browserAPI.runtime.onStartup.addListener(() => {
  console.log('Zen Tab Suspender startup.');
  setupAlarm();
  createContextMenus();
});
