// Initialize default state
chrome.storage.sync.get(['pdfOpenerEnabled'], (result) => {
  if (result.pdfOpenerEnabled === undefined) {
    chrome.storage.sync.set({ pdfOpenerEnabled: true });
    console.log('Initialized pdfOpenerEnabled to true');
  }
});

// Store recently handled download URLs to prevent duplicates
const handledUrls = new Set();
const TIMEOUT = 10000; // 10 seconds timeout for deduplication

// Listen for download events at an earlier stage
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  chrome.storage.sync.get(['pdfOpenerEnabled'], (result) => {
    if (!result.pdfOpenerEnabled) {
      console.log('PDF Opener is disabled');
      return;
    }

    if (downloadItem.mime === 'application/pdf') {
      const url = downloadItem.url;
      console.log('Detected PDF download:', url);

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

      // Cancel the download
      chrome.downloads.cancel(downloadItem.id, (error) => {
        if (chrome.runtime.lastError) {
          console.error('Error cancelling download:', chrome.runtime.lastError.message);
          return;
        }

        // Check if there’s an active window
        chrome.windows.getCurrent({}, (window) => {
          if (chrome.runtime.lastError || !window) {
            // No active window, create a new one
            console.log('No active window found, creating a new window');
            chrome.windows.create({ url: url, focused: true }, (newWindow) => {
              if (chrome.runtime.lastError) {
                console.error('Error creating window:', chrome.runtime.lastError.message);
              } else {
                console.log('Successfully created new window and opened PDF:', newWindow.id);
              }
            });
          } else {
            // Active window exists, create a new tab
            chrome.tabs.create({ url: url, active: true }, (tab) => {
              if (chrome.runtime.lastError) {
                console.error('Error opening tab:', chrome.runtime.lastError.message);
              } else {
                console.log('Successfully opened PDF in new tab:', tab.id);
              }
            });
          }
        });
      });
    }
  });
});

// Clear handled URLs on browser startup to avoid stale data
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, clearing handled URLs');
  handledUrls.clear();
});
