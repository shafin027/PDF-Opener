console.log('PDF Opener content script loaded');

// Initial injection of inject.js
const script = document.createElement('script');
script.id = 'pdf-opener-inject';
script.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();
console.log('Injected inject.js into the page');

// Listen for state updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateState') {
    const isEnabled = message.enabled;
    console.log('Received state update in content script:', isEnabled);
    // Dispatch custom event to inject.js
    const event = new CustomEvent('pdfOpenerStateChange', { detail: { enabled: isEnabled } });
    window.dispatchEvent(event);
    sendResponse({ success: true });
  }
});

// Listen for open PDF requests from inject.js
window.addEventListener('pdfOpenerOpenPdf', (event) => {
  const blobUrl = event.detail.blobUrl;
  console.log('Received open PDF request from inject.js:', blobUrl);
  chrome.runtime.sendMessage({ action: 'openPdfInNewTab', url: blobUrl }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending open PDF message to background:', chrome.runtime.lastError.message);
      // Fallback: Open directly in the page context
      window.location.href = blobUrl;
      console.log('Fallback: Opened PDF in the same window using window.location.href:', blobUrl);
    } else if (!response || !response.success) {
      console.error('Failed to open PDF in the same window:', response);
      window.location.href = blobUrl;
      console.log('Fallback: Opened PDF in the same window using window.location.href:', blobUrl);
    } else {
      console.log('Successfully requested background to open PDF in the same window.');
    }
  });
});