(function() {
let sidebarInitialized = false;
let isProcessingRequest = false;

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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
          <button type="button" id="kagi-toggle-key-visibility" class="kagi-toggle-key-btn" title="Show/hide API key">show</button>
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
          </div>
          <div id="kagi-status-message" class="kagi-status-message"></div>
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
    const toggleKeyVisibilityBtn = document.getElementById('kagi-toggle-key-visibility');
    const removeCitationsCheckbox = document.getElementById('kagi-remove-citations');
    const clearOnHideCheckbox = document.getElementById('kagi-clear-on-hide');
    const closeOnClickAwayCheckbox = document.getElementById('kagi-close-on-click-away');
    
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
          const queryInput = document.getElementById('kagi-query-input');
          const resultsDiv = document.getElementById('kagi-results');
          if (queryInput) queryInput.value = '';
          if (resultsDiv) resultsDiv.innerHTML = '';
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
      browserAPI.runtime.sendMessage({ action: 'openShortcutsPage' }, (response) => {
        if (browserAPI.runtime.lastError) {
          console.error('Runtime error opening shortcuts page:', browserAPI.runtime.lastError);
          showMessage('Failed to open shortcuts page', 'error');
          return;
        }
        
        if (response && !response.success) {
          if (response.showInstructions && response.instructions) {
            showShortcutInstructions(response.instructions);
          } else if (response.error) {
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
    
    if (toggleKeyVisibilityBtn) {
      toggleKeyVisibilityBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleApiKeyVisibility();
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
    
    if (sidebar.contains(e.target)) return;
    
    sidebar.classList.add('kagi-sidebar-hidden');
    
    const clearOnHide = document.getElementById('kagi-clear-on-hide');
    if (clearOnHide && clearOnHide.checked) {
      const queryInput = document.getElementById('kagi-query-input');
      const resultsDiv = document.getElementById('kagi-results');
      if (queryInput) queryInput.value = '';
      if (resultsDiv) resultsDiv.innerHTML = '';
    }
  });
}

function loadSettings() {
  browserAPI.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error('Runtime error getting settings:', browserAPI.runtime.lastError);
      return;
    }
    
    if (response && response.settings) {
      const settings = response.settings;
      const removeCitationsCheckbox = document.getElementById('kagi-remove-citations');
      const clearOnHideCheckbox = document.getElementById('kagi-clear-on-hide');
      const closeOnClickAwayCheckbox = document.getElementById('kagi-close-on-click-away');
      
      if (removeCitationsCheckbox) {
        removeCitationsCheckbox.checked = settings.removeCitations !== false;
      }
      if (clearOnHideCheckbox) {
        clearOnHideCheckbox.checked = settings.clearOnHide !== false;
      }
      if (closeOnClickAwayCheckbox) {
        closeOnClickAwayCheckbox.checked = settings.closeOnClickAway !== false;
      }
    }
  });
}

function saveSettings() {
  const removeCitationsCheckbox = document.getElementById('kagi-remove-citations');
  const clearOnHideCheckbox = document.getElementById('kagi-clear-on-hide');
  const closeOnClickAwayCheckbox = document.getElementById('kagi-close-on-click-away');
  
  const settings = {
    removeCitations: removeCitationsCheckbox ? removeCitationsCheckbox.checked : true,
    clearOnHide: clearOnHideCheckbox ? clearOnHideCheckbox.checked : true,
    closeOnClickAway: closeOnClickAwayCheckbox ? closeOnClickAwayCheckbox.checked : true
  };
  
  browserAPI.runtime.sendMessage({ action: 'saveSettings', settings }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error('Runtime error saving settings:', browserAPI.runtime.lastError);
      return;
    }
    
    if (response && response.success) {
      console.log('Settings saved successfully');
    }
  });
}

function checkApiKey() {
  browserAPI.runtime.sendMessage({ action: 'getApiKey' }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error('Runtime error getting API key:', browserAPI.runtime.lastError);
      return;
    }
    
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
  browserAPI.runtime.sendMessage({ action: 'getKeybind' }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error('Runtime error getting keybind:', browserAPI.runtime.lastError);
      return;
    }
    
    const keybindDisplay = document.getElementById('kagi-keybind-display');
    if (response && response.shortcut) {
      keybindDisplay.textContent = response.shortcut;
    } else {
      keybindDisplay.textContent = 'Not set';
    }
  });
}

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('kagi-api-key');
  const toggleBtn = document.getElementById('kagi-toggle-key-visibility');
  
  if (!apiKeyInput || !toggleBtn) return;
  
  if (apiKeyInput.dataset.masked === 'true' && apiKeyInput.dataset.actualKey) {
    apiKeyInput.value = apiKeyInput.dataset.actualKey;
    apiKeyInput.type = 'text';
    apiKeyInput.dataset.masked = 'false';
    toggleBtn.textContent = 'hide';
    toggleBtn.title = 'Hide API key';
  } else {
    const currentValue = apiKeyInput.value.trim();
    if (currentValue && !apiKeyInput.dataset.actualKey) {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = apiKeyInput.type === 'password' ? 'show' : 'hide';
      toggleBtn.title = apiKeyInput.type === 'password' ? 'Show API key' : 'Hide API key';
    } else if (apiKeyInput.dataset.actualKey) {
      apiKeyInput.value = '*'.repeat(Math.min(apiKeyInput.dataset.actualKey.length, 32));
      apiKeyInput.type = 'password';
      apiKeyInput.dataset.masked = 'true';
      toggleBtn.textContent = 'show';
      toggleBtn.title = 'Show API key';
    }
  }
}

function saveApiKey() {
  const apiKeyInput = document.getElementById('kagi-api-key');
  let apiKey = apiKeyInput.value.trim();
  
  if (apiKeyInput.dataset.masked === 'true' && apiKeyInput.dataset.actualKey) {
    apiKey = apiKeyInput.dataset.actualKey;
  }
  
  if (!apiKey || apiKey === '*'.repeat(apiKey.length)) {
    showMessage('Please enter an API key', 'error');
    return;
  }
  
  browserAPI.runtime.sendMessage({ action: 'saveApiKey', apiKey }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error('Runtime error saving API key:', browserAPI.runtime.lastError);
      showMessage('Failed to save API key: ' + browserAPI.runtime.lastError.message, 'error');
      return;
    }
    
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
      
      const toggleBtn = document.getElementById('kagi-toggle-key-visibility');
      if (toggleBtn) {
        toggleBtn.textContent = 'show';
        toggleBtn.title = 'Show API key';
      }
      
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
  browserAPI.runtime.sendMessage({ action: 'getApiKey' }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error('Runtime error getting API key:', browserAPI.runtime.lastError);
      return;
    }
    
    const apiKeyInput = document.getElementById('kagi-api-key');
    const toggleBtn = document.getElementById('kagi-toggle-key-visibility');
    
    if (response && response.apiKey && apiKeyInput) {
      apiKeyInput.dataset.actualKey = response.apiKey;
      apiKeyInput.value = '*'.repeat(Math.min(response.apiKey.length, 32));
      apiKeyInput.type = 'password';
      apiKeyInput.dataset.masked = 'true';
      
      if (toggleBtn) {
        toggleBtn.textContent = 'show';
        toggleBtn.title = 'Show API key';
      }
    } else if (apiKeyInput) {
      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
      delete apiKeyInput.dataset.actualKey;
      delete apiKeyInput.dataset.masked;
      
      if (toggleBtn) {
        toggleBtn.textContent = 'show';
        toggleBtn.title = 'Show API key';
      }
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
  
  document.getElementById('kagi-query-input').value = '';
  
  const resultsDiv = document.getElementById('kagi-results');
  resultsDiv.innerHTML = '';
  
  const pageContent = includePageContent ? extractPageContent() : null;
  
  if (includePageContent) {
    console.log(`Page content extracted: ${pageContent?.length || 0} characters`);
    console.log('Page content preview:', pageContent?.substring(0, 500) + '...');
    showMessage(`Including page content in query (${pageContent?.length || 0} chars)...`, 'success');
  }
  
  isProcessingRequest = true;
  showLoading(true);
  
  browserAPI.runtime.sendMessage({
    action: 'queryFastGPT',
    query,
    pageContent
  }, (response) => {
    showLoading(false);
    isProcessingRequest = false;
    
    if (browserAPI.runtime.lastError) {
      console.error('Runtime error:', browserAPI.runtime.lastError);
      showMessage('Extension communication error: ' + browserAPI.runtime.lastError.message, 'error');
      return;
    }
    
    if (response && response.success) {
      displayResult(response.data);
    } else {
      const errorMessage = response && response.error ? response.error : 'Request failed';
      console.error('Query failed:', errorMessage, response);
      showMessage(errorMessage, 'error');
    }
  });
}

function extractPageContent() {
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
  
  const truncatedContent = cleanContent.substring(0, 4000);
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

function displayResult(data) {
  const resultsDiv = document.getElementById('kagi-results');
  resultsDiv.textContent = '';
  resultsDiv.appendChild(createResultElement(data));
  
  updateFooterBalance(data.meta);
}

function createResultElement(data) {
  const resultDiv = document.createElement('div');
  resultDiv.className = 'kagi-result';
  
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

function showMessage(message, type) {
  const statusArea = document.getElementById('kagi-status-message');
  if (!statusArea) return;
  
  if (statusArea.timeoutId) {
    clearTimeout(statusArea.timeoutId);
  }
  
  statusArea.textContent = message;
  statusArea.className = `kagi-status-message kagi-status-${type}`;
  
  statusArea.timeoutId = setTimeout(() => {
    statusArea.textContent = '';
    statusArea.className = 'kagi-status-message';
  }, 3000);
}

function showLoading(show) {
  const askPageBtn = document.getElementById('kagi-ask-page');
  const askGeneralBtn = document.getElementById('kagi-ask-general');
  
  if (askPageBtn) {
    askPageBtn.disabled = show;
    if (show) {
      askPageBtn.innerHTML = 'Thinking...';
      askPageBtn.classList.remove('kagi-default-action');
    } else {
      askPageBtn.innerHTML = 'Ask about this page <span class="kagi-enter-hint">⏎</span>';
      askPageBtn.classList.add('kagi-default-action');
    }
  }
  
  if (askGeneralBtn) {
    askGeneralBtn.disabled = show;
    askGeneralBtn.textContent = show ? 'Thinking...' : 'Ask general question';
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
  preElement.style.whiteSpace = 'pre-wrap';
  preElement.style.fontFamily = 'inherit';
  preElement.style.fontSize = '13px';
  preElement.style.lineHeight = '1.6';
  preElement.style.color = '#ccc';
  preElement.style.background = '#3a3a3a';
  preElement.style.padding = '16px';
  preElement.style.borderRadius = '6px';
  preElement.style.margin = '12px 0';
  preElement.textContent = instructions;
  
  contentDiv.appendChild(preElement);
  answerDiv.appendChild(heading);
  answerDiv.appendChild(contentDiv);
  resultDiv.appendChild(answerDiv);
  resultsDiv.appendChild(resultDiv);
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
})();