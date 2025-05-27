document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const settingsTab = document.getElementById('settingsTab');
  const aboutTab = document.getElementById('aboutTab');
  const settingsContent = document.getElementById('settingsContent');
  const aboutContent = document.getElementById('aboutContent');

  // Load saved toggle state
  chrome.storage.sync.get(['pdfOpenerEnabled'], (result) => {
    toggle.checked = result.pdfOpenerEnabled !== false;
  });

  // Save toggle state
  toggle.addEventListener('change', () => {
    chrome.storage.sync.set({ pdfOpenerEnabled: toggle.checked });
  });

  // Tab switching logic
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