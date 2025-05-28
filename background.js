// Local state variable to cache the enabled state
let isEnabled = true;
let previousEnabledState = true; // Track the previous state for reload logic

// Track tabs that have failed to receive messages to limit retries
const failedTabs = new Map(); // Map<tabId, { retries: number, lastError: string }>
const MAX_RETRIES = 3; // Maximum retry attempts per tab

// Initialize default state
chrome.storage.sync.get(['pdfOpenerEnabled'], (result) => {
  if (result.pdfOpenerEnabled === undefined) {
    chrome.storage.sync.set({ pdfOpenerEnabled: true });
    console.log('Initialized pdfOpenerEnabled to true');
  }
  isEnabled = result.pdfOpenerEnabled !== false;
  previousEnabledState = isEnabled; // Set initial previous state
  console.log('Background script initialized with state:', isEnabled);
  updateContentScripts();
  updateDownloadListener();
});

// Store recently handled download URLs to prevent duplicates
const handledUrls = new Set();
const TIMEOUT = 10000; // 10 seconds timeout for deduplication

// Download event listener function
function handleDownloadEvent(downloadItem, suggest) {
  if (!isEnabled) {
    console.log('Extension is disabled, allowing normal PDF download:', downloadItem.url);
    return;
  }

  if (downloadItem.mime === 'application/pdf') {
    const url = downloadItem.url;
    console.log('Detected PDF download:', url);

    // Skip grade-sheet PDFs handled by content script
    if (url.includes('grade-sheet-web?id=')) {
      console.log('Skipping grade-sheet PDF handled by content script:', url);
      return;
    }

    // Check if this URL was recently handled
    if (handledUrls.has(url)) {
      console.log('Duplicate download detected, ignoring:', url);
      return;
    }

    // Add URL to handled set and remove after timeout
    handledUrls.add(url);
    setTimeout(() => {
      handledUrls.delete(url);
      console.log('Removed URL from handled set:', url);
    }, TIMEOUT);

    // Check download state before cancelling
    chrome.downloads.search({ id: downloadItem.id }, (results) => {
      if (results.length === 0 || results[0].state !== 'in_progress') {
        console.log('Download is not in progress, cannot cancel:', downloadItem.id);
        return;
      }

      // Cancel the download and open in the same tab
      chrome.downloads.cancel(downloadItem.id, () => {
        if (chrome.runtime.lastError) {
          console.log('Download cancellation failed (already handled):', chrome.runtime.lastError.message);
          return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length === 0) {
            console.log('No active tab found, falling back to new tab');
            chrome.tabs.create({ url: url, active: true });
            return;
          }
          const activeTab = tabs[0];
          chrome.tabs.update(activeTab.id, { url: url }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('Error updating tab:', chrome.runtime.lastError.message);
            } else {
              console.log('Successfully opened PDF in the same tab:', tab.id);
            }
          });
        });
      });
    });
  }
}

// Function to enable/disable the download listener
function updateDownloadListener() {
  if (isEnabled) {
    chrome.downloads.onDeterminingFilename.addListener(handleDownloadEvent);
    console.log('Download listener enabled.');
  } else {
    chrome.downloads.onDeterminingFilename.removeListener(handleDownloadEvent);
    console.log('Download listener disabled.');
  }
}

// Function to validate if a tab matches the content script's URL pattern
function doesTabMatchPattern(tab) {
  const pattern = /^https?:\/\/connect\.bracu\.ac\.bd\/.*$/;
  return tab.url && pattern.test(tab.url);
}

// Function to attempt injecting content script dynamically
function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.log(`Failed to inject content script into tab ${tabId}:`, chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        console.log(`Successfully injected content script into tab ${tabId}`);
        resolve();
      }
    });
  });
}

// Function to update content scripts with the current state and reload tabs on state change
function updateContentScripts() {
  chrome.tabs.query({ url: '*://connect.bracu.ac.bd/*', status: 'complete' }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.log('No matching tabs found for state update.');
      return;
    }

    tabs.forEach((tab) => {
      const tabId = tab.id;

      // Validate tab URL against the pattern
      if (!doesTabMatchPattern(tab)) {
        console.log(`Tab ${tabId} URL (${tab.url}) does not match content script pattern, skipping.`);
        return;
      }

      // Skip tabs that have failed too many times
      const retryCount = failedTabs.has(tabId) ? failedTabs.get(tabId).retries : 0;
      if (retryCount >= MAX_RETRIES) {
        console.log(`Tab ${tabId} has failed ${MAX_RETRIES} times, skipping state update. Last error:`, failedTabs.get(tabId).lastError);
        return;
      }

      // Attempt to send message
      chrome.tabs.sendMessage(tabId, { action: 'updateState', enabled: isEnabled }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message;
          console.log(`Content script not active in tab ${tabId}, scheduling retry. Error:`, errorMessage);
          const newRetryCount = retryCount + 1;
          failedTabs.set(tabId, { retries: newRetryCount, lastError: errorMessage });

          if (newRetryCount < MAX_RETRIES) {
            // Attempt to inject content script dynamically
            injectContentScript(tabId)
              .then(() => {
                // Retry sending message after injection
                setTimeout(() => {
                  chrome.tabs.get(tabId, (updatedTab) => {
                    if (chrome.runtime.lastError) {
                      console.log(`Tab ${tabId} no longer exists, removing from retry list.`);
                      failedTabs.delete(tabId);
                      return;
                    }
                    if (updatedTab.status === 'complete' && doesTabMatchPattern(updatedTab)) {
                      chrome.tabs.sendMessage(tabId, { action: 'updateState', enabled: isEnabled }, (retryResponse) => {
                        if (chrome.runtime.lastError) {
                          console.log(`Content script still not active in tab ${tabId} after retry ${newRetryCount}. Error:`, chrome.runtime.lastError.message);
                        } else {
                          console.log('Sent state update to content script for tab', tabId, ':', retryResponse);
                          // Reload only if state changed
                          if (isEnabled !== previousEnabledState) {
                            chrome.tabs.reload(tabId, () => {
                              if (chrome.runtime.lastError) {
                                console.log(`Failed to reload tab ${tabId}:`, chrome.runtime.lastError.message);
                              } else {
                                console.log(`Reloaded tab ${tabId} due to state change from ${previousEnabledState} to ${isEnabled}`);
                              }
                            });
                          }
                          failedTabs.delete(tabId);
                        }
                      });
                    } else {
                      console.log(`Tab ${tabId} no longer matches criteria after retry ${newRetryCount}.`);
                      failedTabs.delete(tabId);
                    }
                  });
                }, 1000);
              })
              .catch((error) => {
                console.log(`Tab ${tabId} failed content script injection after retry ${newRetryCount}. Error:`, error);
              });
          }
        } else {
          console.log('Sent state update to content script for tab', tabId, ':', response);
          // Reload only if state changed
          if (isEnabled !== previousEnabledState) {
            chrome.tabs.reload(tabId, () => {
              if (chrome.runtime.lastError) {
                console.log(`Failed to reload tab ${tabId}:`, chrome.runtime.lastError.message);
              } else {
                console.log(`Reloaded tab ${tabId} due to state change from ${previousEnabledState} to ${isEnabled}`);
              }
            });
          }
          failedTabs.delete(tabId);
        }
      });
    });

    // Update previous state after processing all tabs
    previousEnabledState = isEnabled;
  });
}

// Clear handled URLs and failed tabs on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, clearing handled URLs and failed tabs');
  handledUrls.clear();
  failedTabs.clear();
});

// Clear failed tabs when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  failedTabs.delete(tabId);
});

// Handle port connections from popup
chrome.runtime.onConnect.addListener((port) => {
  console.log('Connected to port:', port.name);
  if (port.name === 'popupPort') {
    port.onMessage.addListener((message) => {
      console.log('Received message from popup:', message);
      if (message.action === 'initState' || message.action === 'updateState') {
        isEnabled = message.enabled;
        console.log('Updated state in background script:', isEnabled);
        chrome.storage.sync.set({ pdfOpenerEnabled: isEnabled });
        updateDownloadListener();
        updateContentScripts();
        port.postMessage({ success: true });
      }
    });
  }
});

// Handle wake-up message to activate the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'wakeUp') {
    console.log('Received wake-up message, background script activated.');
    sendResponse({ success: true });
  } else if (message.action === 'openPdfInNewTab') {
    if (!isEnabled) {
      console.log('PDF Opener is disabled, ignoring open request');
      sendResponse({ success: false });
      return;
    }

    const url = message.url;
    console.log('Opening PDF in the same tab:', url);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.log('No active tab found, falling back to new tab');
        chrome.tabs.create({ url: url, active: true }, (tab) => {
          sendResponse({ success: !chrome.runtime.lastError });
        });
        return;
      }
      const activeTab = tabs[0];
      chrome.tabs.update(activeTab.id, { url: url }, (tab) => {
        const success = !chrome.runtime.lastError;
        sendResponse({ success });
        if (!success) {
          console.error('Error updating tab:', chrome.runtime.lastError.message);
        } else {
          console.log('Successfully opened PDF in the same tab:', tab.id);
        }
      });
    });
    return true; // Indicates asynchronous response
  }
});
