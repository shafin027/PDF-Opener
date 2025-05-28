(function () {
  let isEnabled = true; // Default state, updated by toggle

  // Restrict to connect.bracu.ac.bd
  if (!window.location.hostname.includes('connect.bracu.ac.bd')) {
    console.log('Not on connect.bracu.ac.bd, skipping execution.');
    return;
  }

  // Change button to "View PDF" when enabled
  function changeToViewPDF() {
    const buttons = document.querySelectorAll('button.btn.btn-info');
    buttons.forEach((btn) => {
      if (btn.textContent.trim().toLowerCase().includes('download') && !btn.innerHTML.includes('View PDF')) {
        const onclickHandler = btn.getAttribute('onclick');
        btn.innerHTML = `<i class="fas fa-eye fs-4 me-2"></i>View PDF`;
        if (onclickHandler) btn.setAttribute('onclick', onclickHandler);
        console.log('Changed to View PDF:', btn.innerHTML);
      }
    });
  }

  // Revert button to "Download" when disabled
  function revertToDownload() {
    const buttons = document.querySelectorAll('button.btn.btn-info');
    buttons.forEach((btn) => {
      if (btn.innerHTML.includes('View PDF') || btn.innerHTML.includes('fa-eye')) {
        const onclickHandler = btn.getAttribute('onclick');
        btn.innerHTML = '<i class="fa fa-cloud-arrow-down fs-4 me-2"></i>Download';
        if (onclickHandler) btn.setAttribute('onclick', onclickHandler);
        console.log('Reverted to Download:', btn.innerHTML);
      }
    });
  }

  // Set up observer to monitor and enforce button state
  let observer = null;
  function setupButtonObserver() {
    if (observer) {
      observer.disconnect();
    }

    const waitForBody = setInterval(() => {
      if (!document.body) return;

      clearInterval(waitForBody);

      observer = new MutationObserver(() => {
        if (isEnabled) {
          changeToViewPDF();
        } else {
          revertToDownload();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      console.log('Observer started.');

      // Apply initial state
      if (isEnabled) changeToViewPDF();
      else revertToDownload();
    }, 100);
  }

  // Handle toggle state changes
  window.addEventListener('pdfOpenerStateChange', (event) => {
    isEnabled = event.detail.enabled;
    console.log('Toggle state changed to:', isEnabled);
    if (isEnabled) {
      changeToViewPDF();
    } else {
      revertToDownload();
    }
  });

  // Initialize
  setupButtonObserver();
})();