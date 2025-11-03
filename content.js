(function() {
let sidebarInitialized = false;
let isProcessingRequest = false;
let suppressClickAwayUntil = 0;
let currentOrigin = null;
let pendingSelectionText = null;

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function sendMessage(action, payload = {}) {
  return new Promise((resolve) => {
    try {
      const msg = { action, ...payload };
      if (browserAPI.runtime?.sendMessage?.length === 1) {
        browserAPI.runtime.sendMessage(msg).then(resolve).catch(() => resolve(undefined));
      } else {
        browserAPI.runtime.sendMessage(msg, (response) => resolve(response));
      }
    } catch {
      resolve(undefined);
    }
  });
}

window.initKagiFastGPTSidebar = function() {
  if (sidebarInitialized) return;
  
  const sidebar = document.createElement('div');
  sidebar.id = 'kagi-fastgpt-sidebar';
  sidebar.innerHTML = `
    <div class="kagi-resize-handle"></div>
    <div class="kagi-sidebar-header">
      <h3>Kagi FastGPT</h3>
      <button id="kagi-close-btn" type="button">×</button>
    </div>
    <div class="kagi-sidebar-content">
      <div id="kagi-api-setup" class="kagi-section">
        <h3 class="kagi-settings-header">Settings</h3>
        <p>Enter your Kagi API key:</p>
        <div class="kagi-api-key-container">
          <input type="password" id="kagi-api-key" placeholder="Your Kagi API key">
        </div>
        <button id="kagi-save-key">Save</button>
        <p class="kagi-help">Get your API key from <a href="https://kagi.com/settings?p=api" target="_blank">Kagi Settings</a></p>
        
        <div class="kagi-setting">
          <label class="kagi-checkbox-label">
            <input type="checkbox" id="kagi-remove-citations" checked>
            <span>Remove citation markers ([1], [2], etc.)</span>
          </label>
        </div>
        
        <div class="kagi-setting">
          <label class="kagi-checkbox-label">
            <input type="checkbox" id="kagi-clear-on-hide" checked>
            <span>Clear prompt and results when hiding sidebar</span>
          </label>
        </div>
        
        <div class="kagi-setting">
          <label class="kagi-checkbox-label">
            <input type="checkbox" id="kagi-close-on-click-away" checked>
            <span>Close sidebar when clicking outside of it</span>
          </label>
        </div>
        
        <div class="kagi-setting">
          <label class="kagi-checkbox-label" title="Store API key in synced storage across devices">
            <input type="checkbox" id="kagi-sync-api-key">
            <span>Sync API key across devices</span>
          </label>
        </div>
        
        <div class="kagi-setting">
          <div class="kagi-context-length-setting">
            <label for="kagi-max-context-length">Max webpage context (characters):</label>
            <input type="number" id="kagi-max-context-length" min="1000" max="4000000" step="500" value="400000">
            <p class="kagi-help">Default: 400000 (~128K tokens). Max: 4000000 (~1M tokens)</p>
          </div>
        </div>
        
        <div class="kagi-setting">
          <div class="kagi-context-length-setting">
            <label for="kagi-theme">Theme:</label>
            <select id="kagi-theme">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
        
        <div class="kagi-setting">
          <div class="kagi-context-length-setting">
            <label for="kagi-blocked-sites">Blocklist (domains, comma-separated):</label>
            <input type="text" id="kagi-blocked-sites" placeholder="e.g., accounts.google.com, mail.google.com" />
            <p class="kagi-help">Prevents sidebar injection on listed sites</p>
          </div>
        </div>
        
        <div class="kagi-setting">
          <div class="kagi-keybind-info">
            <p><strong>Keyboard Shortcut:</strong></p>
            <div id="kagi-keybind-display">Alt+K</div>
            <p class="kagi-help">
              <button id="kagi-open-shortcuts" type="button">Customize keyboard shortcut</button>
            </p>
          </div>
        </div>
      </div>
      
      <div id="kagi-chat-interface" class="kagi-section kagi-hidden">
        <div class="kagi-query-section">
          <textarea id="kagi-query-input" placeholder="Ask a question about this page or anything else..."></textarea>
          <div class="kagi-query-buttons">
            <button id="kagi-ask-page" class="kagi-default-action">Ask about this page <span class="kagi-enter-hint">⏎</span></button>
            <button id="kagi-ask-general">Ask general question</button>
            <button id="kagi-cancel" class="kagi-clear-btn kagi-hidden" type="button">Cancel</button>
          </div>
          <div id="kagi-status-message" class="kagi-status-message"></div>
        </div>
        
        <div class="kagi-results-header">
          <button id="kagi-clear-results" class="kagi-clear-btn kagi-hidden">Clear History</button>
        </div>
        
        <div id="kagi-results" class="kagi-results-section"></div>
      </div>
      
      <div class="kagi-footer">
        <button id="kagi-settings-btn">Settings</button>
        <span class="kagi-cost-info" id="kagi-cost-info">1.5¢ per query</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  setupEventListeners();
  setupClickAwayHandler();
  checkApiKey();
  loadKeybindDisplay();
  loadSettings();
  currentOrigin = window.location.origin;
  loadConversation();
  initResizeHandle();
  
  sidebarInitialized = true;
  
  setTimeout(() => {
    const chatInterface = document.getElementById('kagi-chat-interface');
    const queryInput = document.getElementById('kagi-query-input');
    if (chatInterface && !chatInterface.classList.contains('kagi-hidden') && queryInput) {
      queryInput.focus();
    }
  }, 150);
};

function setupEventListeners() {
  setTimeout(() => {
    const closeBtn = document.getElementById('kagi-close-btn');
    const saveKeyBtn = document.getElementById('kagi-save-key');
    const askPageBtn = document.getElementById('kagi-ask-page');
    const askGeneralBtn = document.getElementById('kagi-ask-general');
    const settingsBtn = document.getElementById('kagi-settings-btn');
    const queryInput = document.getElementById('kagi-query-input');
    const openShortcutsBtn = document.getElementById('kagi-open-shortcuts');
    const removeCitationsCheckbox = document.getElementById('kagi-remove-citations');
    const clearOnHideCheckbox = document.getElementById('kagi-clear-on-hide');
    const closeOnClickAwayCheckbox = document.getElementById('kagi-close-on-click-away');
    const maxContextLengthInput = document.getElementById('kagi-max-context-length');
    const clearResultsBtn = document.getElementById('kagi-clear-results');
    const cancelBtn = document.getElementById('kagi-cancel');
    const themeSelect = document.getElementById('kagi-theme');
    const syncKeyCheckbox = document.getElementById('kagi-sync-api-key');
    const blockedSitesInput = document.getElementById('kagi-blocked-sites');
    const apiKeyInput = document.getElementById('kagi-api-key');
    
    if (!closeBtn || !saveKeyBtn || !askPageBtn || !askGeneralBtn || !settingsBtn || !queryInput || !openShortcutsBtn) {
      console.error('Kagi FastGPT: Some UI elements not found when setting up event listeners');
      return;
    }
    
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sidebar = document.getElementById('kagi-fastgpt-sidebar');
      if (sidebar) {
        sidebar.classList.add('kagi-sidebar-hidden');
        
        const clearOnHide = document.getElementById('kagi-clear-on-hide');
        if (clearOnHide && clearOnHide.checked) {
          clearResults(true);
        }
      }
    });
    
    saveKeyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveApiKey();
    });
    
    askPageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      askQuestion(true);
    });
    
    askGeneralBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      askQuestion(false);
    });
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await sendMessage('cancelQuery');
        isProcessingRequest = false;
        showLoading(false);
        showMessage('Canceled', 'error');
      });
    }
    
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showSettings();
    });
    
    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          return;
        } else {
          e.preventDefault();
          askQuestion(true);
        }
      }
    });
    
    openShortcutsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendMessage('openShortcutsPage').then((response) => {
        if (response && !response.success) {
          if (response.showInstructions && response.instructions) {
            showShortcutInstructions(response.instructions);
          } else if (response && response.error) {
            showMessage(response.error, 'error');
          }
        }
      });
    });
    
    if (removeCitationsCheckbox) {
      removeCitationsCheckbox.addEventListener('change', saveSettings);
    }
    
    if (clearOnHideCheckbox) {
      clearOnHideCheckbox.addEventListener('change', saveSettings);
    }
    
    if (closeOnClickAwayCheckbox) {
      closeOnClickAwayCheckbox.addEventListener('change', saveSettings);
    }
    
    
    if (maxContextLengthInput) {
      maxContextLengthInput.addEventListener('change', saveSettings);
      maxContextLengthInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value < 1000) e.target.value = 1000;
      });
    }
    
    if (clearResultsBtn) {
      clearResultsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearResults(false);
      });
    }

    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        saveSettings();
      });
    }

    if (syncKeyCheckbox) {
      syncKeyCheckbox.addEventListener('change', (e) => {
        saveSettings();
      });
    }

    if (blockedSitesInput) {
      blockedSitesInput.addEventListener('change', (e) => {
        saveSettings();
      });
    }

    if (apiKeyInput) {
      apiKeyInput.addEventListener('keydown', () => {
        if (apiKeyInput.dataset.masked === 'true') {
          apiKeyInput.value = '';
          apiKeyInput.dataset.masked = 'false';
        }
      });
      apiKeyInput.addEventListener('paste', (e) => {
        if (apiKeyInput.dataset.masked === 'true') {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
          apiKeyInput.value = text;
          apiKeyInput.dataset.masked = 'false';
        }
      });
    }
    
    console.log('Kagi FastGPT: Event listeners set up successfully');
  }, 100);
}

function setupClickAwayHandler() {
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('kagi-fastgpt-sidebar');
    const closeOnClickAwayCheckbox = document.getElementById('kagi-close-on-click-away');
    
    if (!sidebar || !closeOnClickAwayCheckbox) return;
    
    if (!closeOnClickAwayCheckbox.checked) return;
    
    if (sidebar.classList.contains('kagi-sidebar-hidden')) return;
    
    if (Date.now() < suppressClickAwayUntil) return;

    if (sidebar.contains(e.target)) return;
    
    sidebar.classList.add('kagi-sidebar-hidden');
    
    const clearOnHide = document.getElementById('kagi-clear-on-hide');
    if (clearOnHide && clearOnHide.checked) {
      clearResults(true);
    }
  });
  document.addEventListener('contextmenu', (e) => {
    const sidebar = document.getElementById('kagi-fastgpt-sidebar');
    if (!sidebar) return;
    if (sidebar.contains(e.target)) return;
    suppressClickAway(1500);
    try {
      document.documentElement.setAttribute('data-kagi-cm', '1');
      setTimeout(() => document.documentElement.removeAttribute('data-kagi-cm'), 2000);
    } catch {}
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('kagi-fastgpt-sidebar');
      if (sidebar && !sidebar.classList.contains('kagi-sidebar-hidden')) {
        sidebar.classList.add('kagi-sidebar-hidden');
        const clearOnHide = document.getElementById('kagi-clear-on-hide');
        if (clearOnHide && clearOnHide.checked) {
          clearResults(true);
        }
      }
    }
  });
}

function suppressClickAway(ms = 800) {
  suppressClickAwayUntil = Date.now() + Math.max(0, ms | 0);
}
window.kagiSuppressClickAway = suppressClickAway;

function loadSettings() {
  sendMessage('getSettings').then((response) => {
    if (response && response.settings) {
      const settings = response.settings;
      const removeCitationsCheckbox = document.getElementById('kagi-remove-citations');
      const clearOnHideCheckbox = document.getElementById('kagi-clear-on-hide');
      const closeOnClickAwayCheckbox = document.getElementById('kagi-close-on-click-away');
      const maxContextLengthInput = document.getElementById('kagi-max-context-length');
      const themeSelect = document.getElementById('kagi-theme');
      const syncKeyCheckbox = document.getElementById('kagi-sync-api-key');
      const blockedSitesInput = document.getElementById('kagi-blocked-sites');

      if (removeCitationsCheckbox) {
        removeCitationsCheckbox.checked = settings.removeCitations !== false;
      }
      if (clearOnHideCheckbox) {
        clearOnHideCheckbox.checked = settings.clearOnHide !== false;
      }
      if (closeOnClickAwayCheckbox) {
        closeOnClickAwayCheckbox.checked = settings.closeOnClickAway !== false;
      }
      if (maxContextLengthInput) {
        maxContextLengthInput.value = settings.maxContextLength || 400000;
      }
      if (themeSelect) {
        themeSelect.value = settings.theme || 'dark';
        applyTheme(themeSelect.value);
      }
      if (syncKeyCheckbox) {
        syncKeyCheckbox.checked = !!settings.syncApiKey;
      }
      if (blockedSitesInput) {
        blockedSitesInput.value = (settings.blockedSites || []).join(', ');
      }
    }
  });
}

function saveSettings() {
  const removeCitationsCheckbox = document.getElementById('kagi-remove-citations');
  const clearOnHideCheckbox = document.getElementById('kagi-clear-on-hide');
  const closeOnClickAwayCheckbox = document.getElementById('kagi-close-on-click-away');
  const maxContextLengthInput = document.getElementById('kagi-max-context-length');
  const themeSelect = document.getElementById('kagi-theme');
  const syncKeyCheckbox = document.getElementById('kagi-sync-api-key');
  const blockedSitesInput = document.getElementById('kagi-blocked-sites');
  
  const settings = {
    removeCitations: removeCitationsCheckbox ? removeCitationsCheckbox.checked : true,
    clearOnHide: clearOnHideCheckbox ? clearOnHideCheckbox.checked : true,
    closeOnClickAway: closeOnClickAwayCheckbox ? closeOnClickAwayCheckbox.checked : true,
    maxContextLength: maxContextLengthInput ? parseInt(maxContextLengthInput.value) || 400000 : 400000,
    theme: themeSelect ? themeSelect.value : 'dark',
    syncApiKey: syncKeyCheckbox ? !!syncKeyCheckbox.checked : false,
    blockedSites: blockedSitesInput && blockedSitesInput.value
      ? blockedSitesInput.value.split(',').map(s => s.trim()).filter(Boolean)
      : []
  };
  
  sendMessage('saveSettings', { settings }).then((response) => {
    if (response && response.success) {
      applyTheme(settings.theme);
    }
  });
}

function checkApiKey() {
  sendMessage('getApiKey').then((response) => {
    if (response && response.apiKey) {
      document.getElementById('kagi-api-setup').classList.add('kagi-hidden');
      document.getElementById('kagi-chat-interface').classList.remove('kagi-hidden');
      const settingsBtn = document.getElementById('kagi-settings-btn');
      if (settingsBtn) {
        settingsBtn.textContent = 'Settings';
      }
      
      const apiKeyInput = document.getElementById('kagi-api-key');
      if (apiKeyInput) {
        apiKeyInput.dataset.actualKey = response.apiKey;
        apiKeyInput.value = '*'.repeat(Math.min(response.apiKey.length, 32));
        apiKeyInput.dataset.masked = 'true';
      }
    }
  });
}

function loadKeybindDisplay() {
  sendMessage('getKeybind').then((response) => {
    const keybindDisplay = document.getElementById('kagi-keybind-display');
    if (keybindDisplay) {
      if (response && response.shortcut) {
        keybindDisplay.textContent = response.shortcut;
      } else {
        keybindDisplay.textContent = 'Not set';
      }
    }
  });
}


function saveApiKey() {
  const apiKeyInput = document.getElementById('kagi-api-key');
  const typedValue = (apiKeyInput.value || '').trim();

  let apiKey = typedValue;

  if (apiKeyInput.dataset.masked === 'true' && apiKeyInput.dataset.actualKey) {
    const onlyMaskedChars = typedValue.length > 0 && /^[*]+$/.test(typedValue);
    if (onlyMaskedChars) {
      apiKey = apiKeyInput.dataset.actualKey;
    }
  }

  if (!apiKey || /^[*]+$/.test(apiKey)) {
    showMessage('Please enter an API key', 'error');
    return;
  }

  sendMessage('saveApiKey', { apiKey }).then((response) => {
    if (response && response.success) {
      document.getElementById('kagi-api-setup').classList.add('kagi-hidden');
      document.getElementById('kagi-chat-interface').classList.remove('kagi-hidden');
      const settingsBtn = document.getElementById('kagi-settings-btn');
      if (settingsBtn) {
        settingsBtn.textContent = 'Settings';
      }
      showMessage('API key saved successfully!', 'success');

      apiKeyInput.dataset.actualKey = apiKey;
      apiKeyInput.value = '*'.repeat(Math.min(apiKey.length, 32));
      apiKeyInput.type = 'password';
      apiKeyInput.dataset.masked = 'true';

      setTimeout(() => {
        const queryInput = document.getElementById('kagi-query-input');
        if (queryInput) {
          queryInput.focus();
        }
      }, 100);
    }
  });
}

function showSettings() {
  const setup = document.getElementById('kagi-api-setup');
  const chat = document.getElementById('kagi-chat-interface');
  const settingsBtn = document.getElementById('kagi-settings-btn');
  
  if (setup.classList.contains('kagi-hidden')) {
    setup.classList.remove('kagi-hidden');
    chat.classList.add('kagi-hidden');
    if (settingsBtn) {
      settingsBtn.textContent = '← Back';
    }
    
    loadApiKeyForSettings();
  } else {
    setup.classList.add('kagi-hidden');
    chat.classList.remove('kagi-hidden');
    if (settingsBtn) {
      settingsBtn.textContent = 'Settings';
    }
    
    setTimeout(() => {
      const queryInput = document.getElementById('kagi-query-input');
      if (queryInput) {
        queryInput.focus();
      }
    }, 100);
  }
}

function loadApiKeyForSettings() {
  sendMessage('getApiKey').then((response) => {
    const apiKeyInput = document.getElementById('kagi-api-key');
    if (response && response.apiKey && apiKeyInput) {
      apiKeyInput.dataset.actualKey = response.apiKey;
      apiKeyInput.value = '*'.repeat(Math.min(response.apiKey.length, 32));
      apiKeyInput.type = 'password';
      apiKeyInput.dataset.masked = 'true';
    } else if (apiKeyInput) {
      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
      delete apiKeyInput.dataset.actualKey;
      delete apiKeyInput.dataset.masked;
    }
  });
}

function askQuestion(includePageContent) {
  const query = document.getElementById('kagi-query-input').value.trim();
  if (!query) {
    showMessage('Please enter a question', 'error');
    return;
  }
  
  if (isProcessingRequest) {
    showMessage('Please wait for the current request to complete', 'error');
    return;
  }
  
  const queryInput = document.getElementById('kagi-query-input');
  const originalQuery = queryInput.value;
  
  queryInput.value = '';
  
  const maxContextLengthInput = document.getElementById('kagi-max-context-length');
  const maxContextLength = maxContextLengthInput ? parseInt(maxContextLengthInput.value) || 400000 : 400000;
  
  let pageContent = null;
  if (includePageContent) {
    let selectionText = (pendingSelectionText && pendingSelectionText.trim()) || '';
    if (!selectionText && window.getSelection) {
      try { selectionText = (window.getSelection().toString() || '').trim(); } catch {}
    }
    if (selectionText) {
      pageContent = selectionText.substring(0, maxContextLength);
      showMessage(`Including selection as context (${pageContent.length} chars).`, 'success', true);
    } else {
      pageContent = extractPageContent(maxContextLength);
    }
  }
  
  if (includePageContent) {
    console.log(`Page content extracted: ${pageContent?.length || 0} characters`);
    console.log('Page content preview:', pageContent?.substring(0, 500) + '...');
    showMessage(`Including page content in query (${pageContent?.length || 0} chars)...`, 'success', true);
  }
  
  isProcessingRequest = true;
  showLoading(true);
  
  sendMessage('queryFastGPT', { query, pageContent }).then((response) => {
    showLoading(false);
    clearMessage();
    isProcessingRequest = false;
    
    if (response && response.success) {
      displayResult(response.data, originalQuery, includePageContent);
    } else {
      const queryInput = document.getElementById('kagi-query-input');
      if (queryInput) {
        queryInput.value = originalQuery;
      }
      const errorMessage = response && response.error != null ? String(response.error) : 'Request failed';
      console.error('Query failed:', errorMessage, response);
      showMessage(errorMessage, 'error');
    }
  });
}

function extractPageContent(maxContextLength = 400000) {
  const title = document.title;
  const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
  const url = window.location.href;
  
  let content = '';
  const mainSelectors = ['main', 'article', '[role="main"]', '.main-content', '#main', '#content'];
  
  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = element.innerText || element.textContent || '';
      break;
    }
  }
  
  if (!content) {
    content = document.body.innerText || document.body.textContent || '';
  }
  
  const cleanContent = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  const truncatedContent = cleanContent.substring(0, maxContextLength);
  const result = `URL: ${url}\nTitle: ${title}\nDescription: ${metaDescription}\nContent: ${truncatedContent}`;
  
  console.log(`Content extraction breakdown:
    - URL: ${url.length} chars
    - Title: ${title.length} chars  
    - Description: ${metaDescription.length} chars
    - Raw content: ${content.length} chars
    - Cleaned content: ${cleanContent.length} chars
    - Truncated content: ${truncatedContent.length} chars
    - Final payload: ${result.length} chars`);
  
  return result;
}

function displayResult(data, query, includePageContent) {
  const resultsDiv = document.getElementById('kagi-results');
  const clearBtn = document.getElementById('kagi-clear-results');
  
  if (clearBtn) {
    clearBtn.classList.remove('kagi-hidden');
  }
  
  const newResult = createResultElement(data, query, includePageContent);
  
  if (resultsDiv.children.length > 0) {
    const separator = document.createElement('div');
    separator.className = 'kagi-result-separator';
    resultsDiv.insertBefore(separator, resultsDiv.firstChild);
  }
  
  resultsDiv.insertBefore(newResult, resultsDiv.firstChild);
  
  resultsDiv.scrollTop = 0;
  
  updateFooterBalance(data.meta);

  try {
    const item = {
      q: query,
      includePage: !!includePageContent,
      output: data.output,
      tokens: data.tokens,
      references: data.references,
      meta: data.meta,
      ts: Date.now()
    };
    sendMessage('saveConversation', { origin: currentOrigin || window.location.origin, item });
  } catch {}
}

function createResultElement(data, query, includePageContent) {
  const resultDiv = document.createElement('div');
  resultDiv.className = 'kagi-result';
  
  if (query) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'kagi-question';
    
    const questionTitle = document.createElement('h4');
    questionTitle.textContent = includePageContent ? 'Question (with page context):' : 'Question:';
    questionDiv.appendChild(questionTitle);
    
    const questionContent = document.createElement('div');
    questionContent.className = 'kagi-question-content';
    questionContent.textContent = query;
    questionDiv.appendChild(questionContent);
    
    resultDiv.appendChild(questionDiv);
  }
  
  const answerDiv = document.createElement('div');
  answerDiv.className = 'kagi-answer';
  
  const answerTitle = document.createElement('h4');
  answerTitle.textContent = 'Answer:';
  answerDiv.appendChild(answerTitle);
  
  const answerContent = document.createElement('div');
  answerContent.className = 'kagi-answer-content';
  answerContent.appendChild(createFormattedAnswer(data.output));
  answerDiv.appendChild(answerContent);
  
  resultDiv.appendChild(answerDiv);
  
  if (data.references && data.references.length > 0) {
    const referencesDiv = document.createElement('div');
    referencesDiv.className = 'kagi-references';
    
    const referencesTitle = document.createElement('h4');
    referencesTitle.textContent = 'References:';
    referencesDiv.appendChild(referencesTitle);
    
    const referencesList = document.createElement('ul');
    
    data.references.forEach(ref => {
      const listItem = document.createElement('li');
      
      const link = document.createElement('a');
      link.href = sanitizeUrl(ref.url);
      link.target = '_blank';
      link.textContent = ref.title;
      listItem.appendChild(link);
      
      const snippet = document.createElement('p');
      snippet.textContent = ref.snippet;
      listItem.appendChild(snippet);
      
      referencesList.appendChild(listItem);
    });
    
    referencesDiv.appendChild(referencesList);
    resultDiv.appendChild(referencesDiv);
  }
  
  const metaDiv = document.createElement('div');
  metaDiv.className = 'kagi-meta';
  
  const tokensInfo = document.createElement('small');
  tokensInfo.textContent = `Tokens used: ${data.tokens}`;
  metaDiv.appendChild(tokensInfo);
  
  if (data.meta && data.meta.api_balance !== undefined) {
    const balanceInfo = document.createElement('small');
    balanceInfo.textContent = ` • Balance: $${data.meta.api_balance.toFixed(2)}`;
    balanceInfo.style.marginLeft = '8px';
    metaDiv.appendChild(balanceInfo);
  }
  
  resultDiv.appendChild(metaDiv);
  
  return resultDiv;
}

function updateFooterBalance(meta) {
  const costInfo = document.getElementById('kagi-cost-info');
  if (!costInfo) return;
  
  if (meta && meta.api_balance !== undefined) {
    costInfo.textContent = `Balance: $${meta.api_balance.toFixed(2)} • 1.5¢ per query`;
  }
}

function sanitizeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (['http:', 'https:'].includes(parsedUrl.protocol)) {
      return parsedUrl.href;
    }
  } catch {
    return '#';
  }
  return '#';
}

function createFormattedAnswer(text) {
  const removeCitationsCheckbox = document.getElementById('kagi-remove-citations');
  const removeCitations = removeCitationsCheckbox ? removeCitationsCheckbox.checked : true;
  
  let processedText = text;
  
  if (removeCitations) {
    processedText = processedText
      .replace(/\[\d+\]/g, '')
      .replace(/【\d+】/g, '')
      .trim();
  }
  
  const container = document.createElement('div');
  
  const paragraphs = processedText.split(/\n\s*\n/);
  
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const lines = paragraph.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) return;
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      if (line.match(/^\d+\.\s+/)) {
        const ol = document.createElement('ol');
        ol.className = 'kagi-answer-list';
        
        while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
          const listItem = document.createElement('li');
          const content = lines[i].replace(/^\d+\.\s+/, '');
          listItem.appendChild(parseInlineFormatting(content));
          ol.appendChild(listItem);
          i++;
        }
        
        container.appendChild(ol);
      } else if (line.startsWith('- ')) {
        const ul = document.createElement('ul');
        ul.className = 'kagi-answer-list';
        
        while (i < lines.length && lines[i].startsWith('- ')) {
          const listItem = document.createElement('li');
          const content = lines[i].replace(/^- /, '');
          listItem.appendChild(parseInlineFormatting(content));
          ul.appendChild(listItem);
          i++;
        }
        
        container.appendChild(ul);
      } else if (line.startsWith('```') && line.length > 3) {
        const codeBlock = document.createElement('pre');
        const code = document.createElement('code');
        code.className = 'kagi-code-block';
        
        const language = line.substring(3).trim();
        if (language) {
          code.className += ` language-${language}`;
        }
        
        let codeContent = '';
        i++;
        
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeContent += lines[i] + '\n';
          i++;
        }
        
        if (i < lines.length && lines[i].startsWith('```')) {
          i++;
        }
        
        code.textContent = codeContent.trim();
        codeBlock.appendChild(code);
        container.appendChild(codeBlock);
      } else {
        let paragraphContent = line;
        let j = i + 1;
        
        while (j < lines.length && 
               !lines[j].match(/^\d+\.\s+/) && 
               !lines[j].startsWith('- ') && 
               !lines[j].startsWith('```')) {
          paragraphContent += ' ' + lines[j];
          j++;
        }
        
        const p = document.createElement('p');
        p.appendChild(parseInlineFormatting(paragraphContent));
        container.appendChild(p);
        
        i = j;
      }
    }
    
    if (paragraphIndex < paragraphs.length - 1) {
      const spacer = document.createElement('div');
      spacer.style.height = '0.5em';
      container.appendChild(spacer);
    }
  });
  
  return container;
}

function parseInlineFormatting(text) {
  const container = document.createElement('span');
  
  const patterns = [
    { regex: /```([^`]+)```/g, tag: 'code', className: 'kagi-inline-code' },
    { regex: /`([^`]+)`/g, tag: 'code', className: 'kagi-inline-code' },
    { regex: /\*\*([^*]+)\*\*/g, tag: 'strong' },
    { regex: /\*([^*]+)\*/g, tag: 'em' }
  ];
  
  let currentText = text;
  const replacements = [];
  
  patterns.forEach((pattern, patternIndex) => {
    let match;
    pattern.regex.lastIndex = 0;
    
    while ((match = pattern.regex.exec(currentText)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        tag: pattern.tag,
        className: pattern.className,
        priority: patternIndex
      });
    }
  });
  
  replacements.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.priority - b.priority;
  });
  
  const filteredReplacements = [];
  for (const replacement of replacements) {
    const hasOverlap = filteredReplacements.some(existing => 
      !(replacement.end <= existing.start || replacement.start >= existing.end)
    );
    if (!hasOverlap) {
      filteredReplacements.push(replacement);
    }
  }
  
  if (filteredReplacements.length === 0) {
    container.textContent = currentText;
    return container;
  }
  
  let lastIndex = 0;
  
  filteredReplacements.forEach(replacement => {
    if (replacement.start > lastIndex) {
      container.appendChild(document.createTextNode(currentText.substring(lastIndex, replacement.start)));
    }
    
    const element = document.createElement(replacement.tag);
    if (replacement.className) {
      element.className = replacement.className;
    }
    element.textContent = replacement.content;
    container.appendChild(element);
    
    lastIndex = replacement.end;
  });
  
  if (lastIndex < currentText.length) {
    container.appendChild(document.createTextNode(currentText.substring(lastIndex)));
  }
  
  return container;
}

function showMessage(message, type, persistent = false) {
  const statusArea = document.getElementById('kagi-status-message');
  if (!statusArea) return;
  
  if (statusArea.timeoutId) {
    clearTimeout(statusArea.timeoutId);
  }
  
  statusArea.textContent = message;
  statusArea.className = `kagi-status-message kagi-status-${type}`;
  
  if (!persistent) {
    statusArea.timeoutId = setTimeout(() => {
      statusArea.textContent = '';
      statusArea.className = 'kagi-status-message';
    }, 3000);
  }
}

function clearMessage() {
  const statusArea = document.getElementById('kagi-status-message');
  if (!statusArea) return;
  
  if (statusArea.timeoutId) {
    clearTimeout(statusArea.timeoutId);
  }
  
  statusArea.textContent = '';
  statusArea.className = 'kagi-status-message';
}

function showLoading(show) {
  const askPageBtn = document.getElementById('kagi-ask-page');
  const askGeneralBtn = document.getElementById('kagi-ask-general');
  const cancelBtn = document.getElementById('kagi-cancel');
  
  if (askPageBtn) {
    askPageBtn.disabled = show;
    askPageBtn.innerHTML = 'Ask about this page <span class="kagi-enter-hint">⏎</span>';
    if (!show) askPageBtn.classList.add('kagi-default-action');
    else askPageBtn.classList.remove('kagi-default-action');
  }
  
  if (askGeneralBtn) {
    askGeneralBtn.disabled = show;
    askGeneralBtn.textContent = show ? 'Thinking...' : 'Ask general question';
  }

  if (cancelBtn) {
    cancelBtn.classList.toggle('kagi-hidden', !show);
  }
}

function showShortcutInstructions(instructions) {
  const resultsDiv = document.getElementById('kagi-results');
  if (!resultsDiv) return;
  
  resultsDiv.textContent = '';
  
  const resultDiv = document.createElement('div');
  resultDiv.className = 'kagi-result';
  
  const answerDiv = document.createElement('div');
  answerDiv.className = 'kagi-answer';
  
  const heading = document.createElement('h4');
  heading.textContent = 'How to customize keyboard shortcuts';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'kagi-answer-content';
  
  const preElement = document.createElement('pre');
  preElement.textContent = instructions;
  
  contentDiv.appendChild(preElement);
  answerDiv.appendChild(heading);
  answerDiv.appendChild(contentDiv);
  resultDiv.appendChild(answerDiv);
  resultsDiv.appendChild(resultDiv);
}

function clearResults(clearInput = false) {
  const resultsDiv = document.getElementById('kagi-results');
  const clearBtn = document.getElementById('kagi-clear-results');
  const queryInput = document.getElementById('kagi-query-input');
  
  if (resultsDiv) {
    resultsDiv.innerHTML = '';
  }
  
  if (clearBtn) {
    clearBtn.classList.add('kagi-hidden');
  }
  
  if (clearInput && queryInput) {
    queryInput.value = '';
  }
  try {
    sendMessage('clearConversation', { origin: currentOrigin || window.location.origin });
  } catch {}
}

function initResizeHandle() {
  const resizeHandle = document.querySelector('.kagi-resize-handle');
  const sidebar = document.getElementById('kagi-fastgpt-sidebar');
  
  if (!resizeHandle || !sidebar) return;
  
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
    
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = startX - e.clientX;
    const newWidth = Math.max(300, Math.min(800, startWidth + deltaX));
    
    sidebar.style.width = newWidth + 'px';
    
    e.preventDefault();
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      const currentWidth = sidebar.style.width;
      if (currentWidth) {
        localStorage.setItem('kagi-sidebar-width', currentWidth);
      }
    }
  });
  
  const savedWidth = localStorage.getItem('kagi-sidebar-width');
  if (savedWidth) {
    sidebar.style.width = savedWidth;
  }
}

function loadConversation() {
  sendMessage('loadConversation', { origin: window.location.origin }).then((resp) => {
    if (!resp || !resp.items || !Array.isArray(resp.items)) return;
    const resultsDiv = document.getElementById('kagi-results');
    if (!resultsDiv) return;
    for (const item of resp.items) {
      const data = {
        output: item.output,
        tokens: item.tokens,
        references: item.references,
        meta: item.meta
      };
      const resultEl = createResultElement(data, item.q, item.includePage);
      resultsDiv.appendChild(resultEl);
    }
    if (resp.items.length > 0) {
      const clearBtn = document.getElementById('kagi-clear-results');
      if (clearBtn) clearBtn.classList.remove('kagi-hidden');
    }
  });
}

function applyTheme(theme) {
  const sidebar = document.getElementById('kagi-fastgpt-sidebar');
  if (!sidebar) return;
  if (theme === 'light') sidebar.classList.add('kagi-light');
  else sidebar.classList.remove('kagi-light');
}

try {
  browserAPI.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.action === 'kagi_trigger_query') {
      const mode = request.mode;
      if (mode === 'kagi-fastgpt-selection') {
        askQuestion(true);
      } else if (mode === 'kagi-fastgpt-page') {
        askQuestion(true);
      }
      sendResponse({ ok: true });
      return true;
    }
    if (request && request.action === 'kagi_show_sidebar') {
      try {
        pendingSelectionText = request.selectionText || null;
      } catch {}
      try {
        const sidebar = document.getElementById('kagi-fastgpt-sidebar');
        if (sidebar && sidebar.classList.contains('kagi-sidebar-hidden')) {
          sidebar.classList.remove('kagi-sidebar-hidden');
        }
        const setup = document.getElementById('kagi-api-setup');
        const chatInterface = document.getElementById('kagi-chat-interface');
        const settingsBtn = document.getElementById('kagi-settings-btn');
        if (setup && chatInterface) {
          setup.classList.add('kagi-hidden');
          chatInterface.classList.remove('kagi-hidden');
          if (settingsBtn) settingsBtn.textContent = 'Settings';
        }
        if (typeof window.kagiSuppressClickAway === 'function') {
          window.kagiSuppressClickAway(1200);
        }
        const queryInput = document.getElementById('kagi-query-input');
        if (queryInput) {
          queryInput.focus();
        }
        if (pendingSelectionText) {
          showMessage('Selection captured. Type your question and press Enter.', 'success', true);
        }
      } catch {}
      sendResponse({ ok: true });
      return true;
    }
    if (request && request.action === 'kagi_probe') {
      sendResponse({ hasSidebar: !!document.getElementById('kagi-fastgpt-sidebar') });
      return true;
    }
  });
} catch {}
})();
