document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggle');
  const toggleStatus = document.getElementById('toggle-status');

  if (!toggleSwitch) {
    console.error('Toggle switch element not found. Check popup.html for ID "toggle".');
    return;
  }

  if (!toggleStatus) {
    console.error('Toggle status element not found. Check popup.html for ID "toggle-status".');
    return;
  }

  // Function to update the status text
  const updateStatusText = (isEnabled) => {
    toggleStatus.textContent = isEnabled ? 'Enabled' : 'Disabled';
    toggleStatus.className = `text-[10px] font-semibold mb-1 ${isEnabled ? 'text-green-600' : 'text-red-600'}`;
  };

  let port = null;

  // Function to establish or reconnect the port
  const connectToBackground = () => {
    if (port && port.onDisconnect) {
      port.disconnect();
    }
    port = chrome.runtime.connect({ name: 'popupPort' });

    port.onMessage.addListener((message) => {
      console.log('Received response from background:', message);
    });

    port.onDisconnect.addListener(() => {
      console.error('Connection to background script disconnected. Attempting to reconnect...');
      port = null;
      setTimeout(connectToBackground, 1000); // Retry after 1 second
    });

    // Send initial state or wake-up message
    chrome.storage.sync.get(['pdfOpenerEnabled'], (result) => {
      const isEnabled = result.pdfOpenerEnabled !== false;
      toggleSwitch.checked = isEnabled;
      updateStatusText(isEnabled);
      console.log('Initial toggle state loaded:', isEnabled);
      if (port) {
        port.postMessage({ action: 'initState', enabled: isEnabled });
      } else {
        // Fallback: Send a wake-up message
        chrome.runtime.sendMessage({ action: 'wakeUp' }, () => {
          if (chrome.runtime.lastError) {
            console.error('Wake-up message failed:', chrome.runtime.lastError.message);
          } else {
            console.log('Sent wake-up message, retrying connection...');
            setTimeout(connectToBackground, 500); // Retry after 0.5 seconds
          }
        });
      }
    });
  };

  // Initial connection attempt
  connectToBackground();

  // Update state when toggle changes
  toggleSwitch.addEventListener('change', () => {
    const isEnabled = toggleSwitch.checked;
    chrome.storage.sync.set({ pdfOpenerEnabled: isEnabled }, () => {
      console.log('PDF Opener toggled to:', isEnabled);
      updateStatusText(isEnabled);
      if (port) {
        port.postMessage({ action: 'updateState', enabled: isEnabled });
      } else {
        console.error('No port available, state update delayed until connection.');
        connectToBackground(); // Attempt to reconnect and send update
      }
    });
  });

  // Tab switching logic
  const settingsTab = document.getElementById('settingsTab');
  const aboutTab = document.getElementById('aboutTab');
  const settingsContent = document.getElementById('settingsContent');
  const aboutContent = document.getElementById('aboutContent');

  settingsTab.addEventListener('click', () => {
    settingsTab.classList.add('active');
    aboutTab.classList.remove('active');
    settingsContent.classList.remove('hidden');
    aboutContent.classList.add('hidden');
  });

  aboutTab.addEventListener('click', () => {
    aboutTab.classList.add('active');
    settingsTab.classList.remove('active');
    aboutContent.classList.remove('hidden');
    settingsContent.classList.add('hidden');
  });
});