(function() {
  const sidebar = document.getElementById('kagi-fastgpt-sidebar');
  if (sidebar) {
    const wasHidden = sidebar.classList.contains('kagi-sidebar-hidden');
    sidebar.classList.toggle('kagi-sidebar-hidden');
    
    if (wasHidden && !sidebar.classList.contains('kagi-sidebar-hidden')) {
      setTimeout(() => {
        const chatInterface = document.getElementById('kagi-chat-interface');
        const queryInput = document.getElementById('kagi-query-input');
        if (chatInterface && !chatInterface.classList.contains('kagi-hidden') && queryInput) {
          queryInput.focus();
        }
      }, 100);
    }
    
    if (!wasHidden && sidebar.classList.contains('kagi-sidebar-hidden')) {
      const clearOnHide = document.getElementById('kagi-clear-on-hide');
      if (clearOnHide && clearOnHide.checked) {
        const queryInput = document.getElementById('kagi-query-input');
        const resultsDiv = document.getElementById('kagi-results');
        if (queryInput) queryInput.value = '';
        if (resultsDiv) resultsDiv.innerHTML = '';
      }
    }
  } else {
    if (typeof window.initKagiFastGPTSidebar === 'function') {
      window.initKagiFastGPTSidebar();
    }
  }
})(); 