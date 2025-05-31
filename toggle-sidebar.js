const sidebar = document.getElementById('kagi-fastgpt-sidebar');
if (sidebar) {
  sidebar.classList.toggle('kagi-sidebar-hidden');
} else {
  if (typeof window.initKagiFastGPTSidebar === 'function') {
    window.initKagiFastGPTSidebar();
  }
} 