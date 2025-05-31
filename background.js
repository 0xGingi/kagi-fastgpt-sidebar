const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const actionAPI = browserAPI.action || browserAPI.browserAction;

actionAPI.onClicked.addListener(async (tab) => {
  try {
    if (browserAPI.tabs && browserAPI.tabs.executeScript) {
      await browserAPI.tabs.executeScript(tab.id, {
        file: 'toggle-sidebar.js'
      });
    } else if (browserAPI.scripting) {
      await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['toggle-sidebar.js']
      });
    }
  } catch (error) {
    console.error('Failed to toggle sidebar:', error);
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
  return data.data;
} 