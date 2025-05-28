// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const settingsTabButton = document.getElementById('settingsTab');
  const aboutTabButton = document.getElementById('aboutTab');
  const settingsContent = document.getElementById('settingsContent');
  const aboutContent = document.getElementById('aboutContent');

  // Basic check if elements exist
  if (!settingsTabButton || !aboutTabButton || !settingsContent || !aboutContent) {
    console.error('PDF Opener: One or more tab UI elements are missing!');
    return;
  }

  const tabInfo = [
    { button: settingsTabButton, content: settingsContent, id: 'settings' },
    { button: aboutTabButton, content: aboutContent, id: 'about' }
  ];

  function showTab(tabIdToShow) {
    tabInfo.forEach(tab => {
      const isTargetTab = tab.id === tabIdToShow;
      
      // Show/Hide Content based on '.hidden' class
      // Your styles.css '.tab-content.hidden' will apply display:none
      if (isTargetTab) {
        tab.content.classList.remove('hidden');
      } else {
        tab.content.classList.add('hidden');
      }

      // Set active class on button
      // Your styles.css '.tab-button.active' will style it
      if (isTargetTab) {
        tab.button.classList.add('active');
      } else {
        tab.button.classList.remove('active');
      }
    });
  }

  // Add click event listeners to tab buttons
  settingsTabButton.addEventListener('click', () => showTab('settings'));
  aboutTabButton.addEventListener('click', () => showTab('about'));

  // Determine and show initial tab based on HTML 'active' class or default
  let initialTab = 'settings'; // Default to 'settings'
  if (settingsTabButton.classList.contains('active')) {
    initialTab = 'settings';
  } else if (aboutTabButton.classList.contains('active')) { // If you change default in HTML
    initialTab = 'about';
  }
  showTab(initialTab); // Initialize the view

  // --- Your Toggle Switch Logic (from previous good version) ---
  const toggle = document.getElementById('toggle');
  const toggleStatus = document.getElementById('toggle-status');

  if (toggle && toggleStatus) {
    // Load saved state for the toggle
    chrome.storage.local.get(['pdfOpenerEnabled'], function(result) {
      const isEnabled = result.pdfOpenerEnabled !== false; // Default to true if not set
      toggle.checked = isEnabled;
      updateStatusText(isEnabled);
    });

    toggle.addEventListener('change', function() {
      const isEnabled = this.checked;
      chrome.storage.local.set({pdfOpenerEnabled: isEnabled}, function() {
        updateStatusText(isEnabled);
      });
    });

    function updateStatusText(isEnabled) {
      toggleStatus.textContent = isEnabled ? 'Enabled' : 'Disabled';
      // Ensure Tailwind classes are available for these colors
      toggleStatus.className = `text-[10px] font-semibold mb-1 ${isEnabled ? 'text-green-600' : 'text-red-600'}`;
    }
  } else {
    console.warn("PDF Opener: Toggle switch or status element not found in popup.html.");
  }
});
