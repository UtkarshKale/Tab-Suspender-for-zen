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
})();
