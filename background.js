// Initialize default state
chrome.storage.sync.get(['pdfOpenerEnabled'], (result) => {
  if (result.pdfOpenerEnabled === undefined) {
    chrome.storage.sync.set({ pdfOpenerEnabled: true });
    console.log('Initialized pdfOpenerEnabled to true');
  }
});

// Listen for download events
chrome.downloads.onCreated.addListener((downloadItem) => {
  chrome.storage.sync.get(['pdfOpenerEnabled'], (result) => {
    if (!result.pdfOpenerEnabled) {
      console.log('PDF Opener is disabled');
      return;
    }

    if (downloadItem.mime === 'application/pdf') {
      console.log('Detected PDF download:', downloadItem.url);
      // Cancel the download
      chrome.downloads.cancel(downloadItem.id, (error) => {
        if (chrome.runtime.lastError) {
          console.error('Error cancelling download:', chrome.runtime.lastError.message);
          return;
        }
        // Open PDF in a new tab
        chrome.tabs.create({ url: downloadItem.url, active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error('Error opening tab:', chrome.runtime.lastError.message);
          } else {
            console.log('Successfully opened PDF in new tab:', tab.id);
          }
        });
      });
    }
  });
});