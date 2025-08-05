const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const actionAPI = browserAPI.action || browserAPI.browserAction;

async function toggleSidebar(tab) {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
      tab.url.startsWith('moz-extension://') || tab.url.startsWith('about:') || 
      tab.url.startsWith('edge://') || tab.url.startsWith('opera://')) {
    console.log('Cannot inject content script into restricted URL:', tab.url);
    return;
  }

  try {
    const results = await browserAPI.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return {
          hasContent: typeof window.initKagiFastGPTSidebar === 'function',
          hasSidebar: !!document.getElementById('kagi-fastgpt-sidebar')
        };
      }
    });
    
    const pageState = results[0]?.result;
    
    if (!pageState?.hasContent) {
      try {
        await browserAPI.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['sidebar.css']
        });
      } catch (cssError) {
        console.log('CSS already inserted or failed to insert:', cssError.message);
      }
      
      await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    }
    
    await browserAPI.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['toggle-sidebar.js']
    });
  } catch (error) {
    console.error('Failed to toggle sidebar:', error);
  }
}

actionAPI.onClicked.addListener(async (tab) => {
  await toggleSidebar(tab);
});

browserAPI.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-sidebar') {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await toggleSidebar(tabs[0]);
    }
  }
});

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'queryFastGPT') {
    handleFastGPTQuery(request.query, request.pageContent)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getApiKey') {
    browserAPI.storage.sync.get(['kagiApiKey'], (result) => {
      sendResponse({ apiKey: result.kagiApiKey });
    });
    return true;
  }
  
  if (request.action === 'saveApiKey') {
    browserAPI.storage.sync.set({ kagiApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getKeybind') {
    browserAPI.commands.getAll((commands) => {
      const toggleCommand = commands.find(cmd => cmd.name === 'toggle-sidebar');
      sendResponse({ shortcut: toggleCommand?.shortcut || 'Not set' });
    });
    return true;
  }
  
  if (request.action === 'openShortcutsPage') {
    const isFirefox = typeof browser !== 'undefined';
    
    if (isFirefox) {
      sendResponse({ 
        success: false, 
        showInstructions: true,
        instructions: 'To customize keyboard shortcuts in Firefox:\n\n1. Click the Firefox menu (☰)\n2. Select "Add-ons and themes"\n3. Find "Kagi FastGPT Sidebar"\n4. Click on the extension\n5. Look for keyboard shortcuts settings\n\nAlternatively, type about:addons in your address bar.'
      });
    } else {
      browserAPI.tabs.create({ url: 'chrome://extensions/shortcuts' });
      sendResponse({ success: true });
    }
    
    return true;
  }
  
  if (request.action === 'getSettings') {
    browserAPI.storage.sync.get(['kagiSettings'], (result) => {
      const defaultSettings = {
        removeCitations: true,
        clearOnHide: true,
        closeOnClickAway: true,
        maxContextLength: 400000
      };
      const settings = result.kagiSettings || defaultSettings;
      sendResponse({ settings });
    });
    return true;
  }
  
  if (request.action === 'saveSettings') {
    browserAPI.storage.sync.set({ kagiSettings: request.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleFastGPTQuery(query, pageContent) {
  const result = await browserAPI.storage.sync.get(['kagiApiKey']);
  const apiKey = result && result.kagiApiKey;
  
  if (!apiKey) {
    throw new Error('API key not configured. Please set your Kagi API key in the extension settings.');
  }
  
  let finalQuery = query;
  if (pageContent) {
    const truncatedContent = pageContent.substring(0, 3000);
    finalQuery = `Based on this webpage content: "${truncatedContent}", ${query}`;
    console.log(`FastGPT Query - Page content: ${truncatedContent.length} chars, User query: ${query.length} chars, Total: ${finalQuery.length} chars`);
  } else {
    console.log(`FastGPT Query - User query only: ${finalQuery.length} chars`);
  }
  
  const response = await fetch('https://kagi.com/api/v0/fastgpt', {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: finalQuery,
      web_search: true,
      cache: true
    })
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Kagi API key.');
    } else if (response.status === 402) {
      throw new Error('Insufficient API credits. Please top up your Kagi API credits.');
    } else {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
  }
  
  const data = await response.json();
  return {
    ...data.data,
    meta: data.meta
  };
} 