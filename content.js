let sidebarInitialized = false;
let isProcessingRequest = false;

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

window.initKagiFastGPTSidebar = function() {
  if (sidebarInitialized) return;
  
  const sidebar = document.createElement('div');
  sidebar.id = 'kagi-fastgpt-sidebar';
  sidebar.innerHTML = `
    <div class="kagi-sidebar-header">
      <h3>Kagi FastGPT</h3>
      <button id="kagi-close-btn" type="button">×</button>
    </div>
    <div class="kagi-sidebar-content">
      <div id="kagi-api-setup" class="kagi-section">
        <p>Enter your Kagi API key:</p>
        <input type="password" id="kagi-api-key" placeholder="Your Kagi API key">
        <button id="kagi-save-key">Save</button>
        <p class="kagi-help">Get your API key from <a href="https://kagi.com/settings?p=api" target="_blank">Kagi Settings</a></p>
        
        <div class="kagi-setting">
          <label class="kagi-checkbox-label">
            <input type="checkbox" id="kagi-remove-citations" checked>
            <span>Remove citation markers ([1], [2], etc.)</span>
          </label>
        </div>
      </div>
      
      <div id="kagi-chat-interface" class="kagi-section kagi-hidden">
        <div class="kagi-query-section">
          <textarea id="kagi-query-input" placeholder="Ask a question about this page or anything else..."></textarea>
          <div class="kagi-query-buttons">
            <button id="kagi-ask-page">Ask about this page</button>
            <button id="kagi-ask-general">Ask general question</button>
          </div>
        </div>
        
        <div id="kagi-results" class="kagi-results-section"></div>
      </div>
      
      <div class="kagi-footer">
        <button id="kagi-settings-btn">Settings</button>
        <span class="kagi-cost-info">1.5¢ per query</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  setupEventListeners();
  checkApiKey();
  sidebarInitialized = true;
};

function setupEventListeners() {
  const closeBtn = document.getElementById('kagi-close-btn');
  const saveKeyBtn = document.getElementById('kagi-save-key');
  const askPageBtn = document.getElementById('kagi-ask-page');
  const askGeneralBtn = document.getElementById('kagi-ask-general');
  const settingsBtn = document.getElementById('kagi-settings-btn');
  const queryInput = document.getElementById('kagi-query-input');
  
  closeBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('kagi-fastgpt-sidebar');
    sidebar.classList.add('kagi-sidebar-hidden');
  });
  
  saveKeyBtn.addEventListener('click', saveApiKey);
  askPageBtn.addEventListener('click', () => askQuestion(true));
  askGeneralBtn.addEventListener('click', () => askQuestion(false));
  settingsBtn.addEventListener('click', showSettings);
  
  queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      askQuestion(false);
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
    }
  });
}

function saveApiKey() {
  const apiKey = document.getElementById('kagi-api-key').value.trim();
  if (!apiKey) {
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
      showMessage('API key saved successfully!', 'success');
    }
  });
}

function showSettings() {
  const setup = document.getElementById('kagi-api-setup');
  const chat = document.getElementById('kagi-chat-interface');
  
  if (setup.classList.contains('kagi-hidden')) {
    setup.classList.remove('kagi-hidden');
    chat.classList.add('kagi-hidden');
  } else {
    setup.classList.add('kagi-hidden');
    chat.classList.remove('kagi-hidden');
  }
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
    console.log('Page content being sent:', pageContent?.substring(0, 500) + '...');
    showMessage('Including page content in query...', 'success');
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
  
  return `URL: ${url}\nTitle: ${title}\nDescription: ${metaDescription}\nContent: ${cleanContent.substring(0, 4000)}`;
}

function displayResult(data) {
  const resultsDiv = document.getElementById('kagi-results');
  
  const resultHtml = `
    <div class="kagi-result">
      <div class="kagi-answer">
        <h4>Answer:</h4>
        <div class="kagi-answer-content">${formatAnswer(data.output)}</div>
      </div>
      
      ${data.references && data.references.length > 0 ? `
        <div class="kagi-references">
          <h4>References:</h4>
          <ul>
            ${data.references.map(ref => `
              <li>
                <a href="${ref.url}" target="_blank">${ref.title}</a>
                <p>${ref.snippet}</p>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      
      <div class="kagi-meta">
        <small>Tokens used: ${data.tokens}</small>
      </div>
    </div>
  `;
  
  resultsDiv.innerHTML = resultHtml;
}

function formatAnswer(text) {
  const removeCitations = document.getElementById('kagi-remove-citations')?.checked ?? true;
  
  let formatted = text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(.*?)```/g, '<code class="kagi-inline-code">$1</code>')
    .replace(/`([^`]+)`/g, '<code class="kagi-inline-code">$1</code>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul class="kagi-answer-list">$1</ul>');
  
  if (removeCitations) {
    formatted = formatted
      .replace(/\[\d+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return formatted;
}

function showMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `kagi-message kagi-message-${type}`;
  messageDiv.textContent = message;
  
  const sidebar = document.getElementById('kagi-fastgpt-sidebar');
  sidebar.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

function showLoading(show) {
  const buttons = document.querySelectorAll('#kagi-ask-page, #kagi-ask-general');
  buttons.forEach(btn => {
    btn.disabled = show;
    btn.textContent = show ? 'Thinking...' : (btn.id === 'kagi-ask-page' ? 'Ask about this page' : 'Ask general question');
  });
}