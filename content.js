// Zen Tab Suspender - Content Script
// Detects when the user is actively typing in forms to prevent accidental data loss.
'use strict';

(function() {
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  
  // Track state of inputs typed into by the user
  const activeInputs = new Set();
  let reportedActive = false;

  // Check if an input element contains meaningful text filled in by the user
  function isMeaningfulInput(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    
    // Check if it's a textarea
    if (tagName === 'textarea') {
      return element.value && element.value.trim().length > 0;
    }
    
    // Check if it's a text input
    if (tagName === 'input') {
      const type = (element.type || 'text').toLowerCase();
      const textTypes = ['text', 'email', 'url', 'search', 'tel', 'number', 'password'];
      
      if (textTypes.includes(type)) {
        return element.value && element.value.trim().length > 0;
      }
    }
    
    return false;
  }

  // Evaluate form elements and notify the background script
  function evaluateInputs(event) {
    const target = event.target;
    if (!target) return;

    if (isMeaningfulInput(target)) {
      activeInputs.add(target);
    } else {
      activeInputs.delete(target);
    }

    // Clean up elements that are no longer in the DOM
    for (const input of activeInputs) {
      if (!document.body.contains(input)) {
        activeInputs.delete(input);
      }
    }

    const hasActiveInputs = activeInputs.size > 0;

    // Report active state if changed
    if (hasActiveInputs && !reportedActive) {
      browserAPI.runtime.sendMessage({ method: 'markFormActive' }).catch(console.error);
      reportedActive = true;
    } else if (!hasActiveInputs && reportedActive) {
      browserAPI.runtime.sendMessage({ method: 'markFormInactive' }).catch(console.error);
      reportedActive = false;
    }
  }

  // Handle standard input and change events in capturing phase for maximum compatibility
  document.addEventListener('input', evaluateInputs, true);
  document.addEventListener('change', evaluateInputs, true);

  // Monitor form submit/reset to clean up active inputs
  document.addEventListener('submit', (e) => {
    activeInputs.clear();
    if (reportedActive) {
      browserAPI.runtime.sendMessage({ method: 'markFormInactive' }).catch(console.error);
      reportedActive = false;
    }
  }, true);

  document.addEventListener('reset', (e) => {
    activeInputs.clear();
    if (reportedActive) {
      browserAPI.runtime.sendMessage({ method: 'markFormInactive' }).catch(console.error);
      reportedActive = false;
    }
  }, true);

  // Estimate the tab's active RAM footprint (in bytes)
  function estimateTabMemory() {
    try {
      // 1. Baseline overhead for any browser tab process (50MB)
      let memoryBytes = 50 * 1024 * 1024;
      
      // 2. DOM Node complexity (approx 3KB per element node)
      const domNodesCount = document.getElementsByTagName('*').length;
      memoryBytes += domNodesCount * 3000;
      
      // 3. Image decodes (approx 1.5MB per visible image, 200KB per tiny image)
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        const width = img.naturalWidth || img.clientWidth || 0;
        const height = img.naturalHeight || img.clientHeight || 0;
        if (width > 0 && height > 0) {
          // Bitmap memory = width * height * 4 bytes (RGBA)
          memoryBytes += (width * height * 4);
        } else {
          // Default fallback for unloadable/hidden images (150KB)
          memoryBytes += 150000;
        }
      });
      
      // 4. JavaScript compiled script overhead (approx 250KB per script tag)
      const scriptsCount = document.getElementsByTagName('script').length;
      memoryBytes += scriptsCount * 250000;
      
      // 5. CSS stylesheet rules and style layers (approx 150KB per style/link element)
      const stylesCount = document.getElementsByTagName('style').length + document.getElementsByTagName('link').length;
      memoryBytes += stylesCount * 150000;
      
      // 6. Local Storage / Session Storage weight
      try {
        let storageWeight = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          storageWeight += key.length + localStorage.getItem(key).length;
        }
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          storageWeight += key.length + sessionStorage.getItem(key).length;
        }
        memoryBytes += storageWeight * 2; // UTF-16 characters = 2 bytes
      } catch (e) {}

      // Cap the memory estimation between 60MB (minimum) and 1.5GB (maximum) to keep metrics realistic
      const minBytes = 60 * 1024 * 1024;
      const maxBytes = 1500 * 1024 * 1024;
      
      return Math.max(minBytes, Math.min(memoryBytes, maxBytes));
    } catch (e) {
      // Fallback if estimation fails (95MB default)
      return 95 * 1024 * 1024;
    }
  }

  // Listen for messages from background script
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.method === 'getMemoryEstimation') {
      const estimatedBytes = estimateTabMemory();
      sendResponse({ memoryBytes: estimatedBytes });
    }
  });
})();
