const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function storageGet(area, keys) {
  return new Promise((resolve, reject) => {
    try {
      const api = browserAPI.storage?.[area];
      if (!api || typeof api.get !== 'function') return resolve({});
      if (api.get.length <= 1) {
        api.get(keys).then(resolve).catch(reject);
      } else {
        api.get(keys, (result) => {
          const err = browserAPI.runtime?.lastError;
          if (err) reject(err);
          else resolve(result || {});
        });
      }
    } catch (e) {
      resolve({});
    }
  });
}

function storageSet(area, items) {
  return new Promise((resolve, reject) => {
    try {
      const api = browserAPI.storage?.[area];
      if (!api || typeof api.set !== 'function') return resolve();
      if (api.set.length <= 1) {
        api.set(items).then(resolve).catch(reject);
      } else {
        api.set(items, () => {
          const err = browserAPI.runtime?.lastError;
          if (err) reject(err);
          else resolve();
        });
      }
    } catch (e) {
      resolve();
    }
  });
}

function commandsGetAll() {
  return new Promise((resolve) => {
    try {
      const api = browserAPI.commands;
      if (!api || typeof api.getAll !== 'function') return resolve([]);
      if (api.getAll.length === 0) {
        api.getAll().then(resolve).catch(() => resolve([]));
      } else {
        api.getAll((cmds) => resolve(cmds || []));
      }
    } catch {
      resolve([]);
    }
  });
}

async function insertCSS(target, files) {
  if (browserAPI.scripting?.insertCSS) {
    try {
      await browserAPI.scripting.insertCSS({ target, files });
    } catch (_) {}
    return;
  }
  if (browserAPI.tabs?.insertCSS) {
    for (const file of files) {
      await new Promise((resolve) => browserAPI.tabs.insertCSS(target.tabId, { file }, () => resolve()));
    }
  }
}

async function executeFiles(target, files) {
  if (browserAPI.scripting?.executeScript) {
    await browserAPI.scripting.executeScript({ target, files });
    return;
  }
  for (const file of files) {
    await new Promise((resolve) => browserAPI.tabs.executeScript(target.tabId, { file }, () => resolve()));
  }
}

const actionAPI = browserAPI.action || browserAPI.browserAction;

const RESTRICTED_HOSTS = [
  'chromewebstore.google.com',
  'chrome.google.com',
  'addons.mozilla.org',
  'microsoftedge.microsoft.com',
  'addons.opera.com'
];

function isRestrictedUrl(urlString) {
  try {
    if (!urlString) return true;
    if (
      urlString.startsWith('chrome://') ||
      urlString.startsWith('chrome-extension://') ||
      urlString.startsWith('moz-extension://') ||
      urlString.startsWith('about:') ||
      urlString.startsWith('edge://') ||
      urlString.startsWith('opera://')
    ) {
      return true;
    }
    const url = new URL(urlString);
    return RESTRICTED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return true;
  }
}

const lastWarned = new Map();

async function warnRestrictedSite(tab, reason = 'This page blocks extensions from injecting content.') {
  try {
    const url = tab?.url ? new URL(tab.url) : null;
    const hostKey = url?.hostname || String(tab?.id || 'global');
    const now = Date.now();
    const last = lastWarned.get(hostKey) || 0;
    if (now - last < 8000) return;
    lastWarned.set(hostKey, now);

    const title = 'Kagi FastGPT Sidebar';
    const msg = `Sidebar cannot open on ${url?.hostname || 'this page'}. ${reason}`;

    if (browserAPI.notifications?.create) {
      try {
        const id = `kagi-fastgpt-warning-${hostKey}-${now}`;
        await new Promise((resolve) =>
          browserAPI.notifications.create(
            id,
            {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title,
              message: msg
            },
            () => resolve()
          )
        );
        setTimeout(() => browserAPI.notifications.clear?.(id), 6000);
      } catch (e) {
      }
    }

    try {
      const tabId = tab?.id;
      if (tabId && actionAPI?.setBadgeText) {
        actionAPI.setBadgeBackgroundColor?.({ color: '#d9534f', tabId });
        actionAPI.setBadgeText({ text: '!', tabId });
        const prevTitle = tab?.title || '';
        actionAPI.setTitle?.({ tabId, title: `${title}: ${msg}` });
        setTimeout(() => {
          actionAPI.setBadgeText?.({ text: '', tabId });
          actionAPI.setTitle?.({ tabId, title: 'Toggle Kagi FastGPT Sidebar' });
        }, 4000);
      }
    } catch {}
  } catch {}
}

async function getSettings() {
  const result = await storageGet('sync', ['kagiSettings']);
  const defaultSettings = {
    removeCitations: true,
    clearOnHide: true,
    closeOnClickAway: true,
    maxContextLength: 400000,
    theme: 'dark',
    syncApiKey: false,
    blockedSites: []
  };
  return { ...defaultSettings, ...(result.kagiSettings || {}) };
}

const activeControllers = new Map();

async function toggleSidebar(tab) {
  if (isRestrictedUrl(tab?.url)) {
    console.log('Cannot inject content script into restricted URL:', tab?.url);
    await warnRestrictedSite(tab, 'The browser restricts extensions on this site.');
    return;
  }

  // Blocklist check
  try {
    const settings = await getSettings();
    const url = new URL(tab.url);
    const host = url.hostname;
    const blocked = Array.isArray(settings.blockedSites) ? settings.blockedSites : [];
    if (blocked.some((d) => d && host.endsWith(d))) {
      console.log('Kagi FastGPT: injection blocked for host', host);
      await warnRestrictedSite(tab, 'This site is in your blocklist.');
      return;
    }
  } catch {}

  try {
    let results;
    if (browserAPI.scripting?.executeScript) {
      results = await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            hasContent: typeof window.initKagiFastGPTSidebar === 'function',
            hasSidebar: !!document.getElementById('kagi-fastgpt-sidebar')
          };
        }
      });
    } else {
      try {
        const probe = await new Promise((resolve) => {
          browserAPI.tabs.sendMessage(tab.id, { action: 'kagi_probe' }, (resp) => resolve(resp));
        });
        results = [{ result: { hasContent: !!probe, hasSidebar: probe?.hasSidebar } }];
      } catch {
        results = [{ result: { hasContent: false, hasSidebar: false } }];
      }
    }
    
    const pageState = results[0]?.result;
    
    if (!pageState?.hasContent) {
      await insertCSS({ tabId: tab.id }, ['sidebar.css']);
      await executeFiles({ tabId: tab.id }, ['content.js']);
    }
    
    await executeFiles({ tabId: tab.id }, ['toggle-sidebar.js']);
  } catch (error) {
    console.error('Failed to toggle sidebar:', error);
    if (isRestrictedUrl(tab?.url)) {
      await warnRestrictedSite(tab, 'The browser restricts extensions on this site.');
    }
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
    handleFastGPTQuery(request.query, request.pageContent, sender?.tab?.id)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getApiKey') {
    (async () => {
      const local = await storageGet('local', ['kagiApiKey']);
      let key = local.kagiApiKey;
      if (!key) {
        const sync = await storageGet('sync', ['kagiApiKey']);
        key = sync.kagiApiKey;
      }
      sendResponse({ apiKey: key });
    })();
    return true;
  }
  
  if (request.action === 'saveApiKey') {
    (async () => {
      await storageSet('local', { kagiApiKey: request.apiKey });
      const settings = await getSettings();
      if (settings.syncApiKey) {
        await storageSet('sync', { kagiApiKey: request.apiKey });
      }
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (request.action === 'getKeybind') {
    (async () => {
      const commands = await commandsGetAll();
      const toggleCommand = commands.find(cmd => cmd.name === 'toggle-sidebar');
      sendResponse({ shortcut: toggleCommand?.shortcut || 'Not set' });
    })();
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
    (async () => {
      const settings = await getSettings();
      sendResponse({ settings });
    })();
    return true;
  }
  
  if (request.action === 'saveSettings') {
    (async () => {
      await storageSet('sync', { kagiSettings: request.settings });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'cancelQuery') {
    const tabId = sender?.tab?.id;
    const controller = tabId != null ? activeControllers.get(tabId) : null;
    if (controller) {
      controller.abort();
      activeControllers.delete(tabId);
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'saveConversation') {
    (async () => {
      const { origin, item } = request;
      if (!origin || !item) return sendResponse({ success: false });
      const key = `kagiConversation:${origin}`;
      const existing = await storageGet('local', [key]);
      const list = Array.isArray(existing[key]) ? existing[key] : [];
      const updated = [item, ...list].slice(0, 20);
      await storageSet('local', { [key]: updated });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'loadConversation') {
    (async () => {
      const { origin } = request;
      const key = `kagiConversation:${origin}`;
      const data = await storageGet('local', [key]);
      sendResponse({ success: true, items: data[key] || [] });
    })();
    return true;
  }

  if (request.action === 'clearConversation') {
    (async () => {
      const { origin } = request;
      const key = `kagiConversation:${origin}`;
      await storageSet('local', { [key]: [] });
      sendResponse({ success: true });
    })();
    return true;
  }
});

async function handleFastGPTQuery(query, pageContent, tabId) {
  // Prefer local first
  const local = await storageGet('local', ['kagiApiKey']);
  let apiKey = local && local.kagiApiKey;
  if (!apiKey) {
    const sync = await storageGet('sync', ['kagiApiKey']);
    apiKey = sync && sync.kagiApiKey;
  }
  
  if (!apiKey) {
    throw new Error('API key not configured. Please set your Kagi API key in the extension settings.');
  }
  
  let finalQuery = query;
  if (pageContent) {
    finalQuery = `Based on this webpage content: "${pageContent}", ${query}`;
    console.log(`FastGPT Query - Page content: ${pageContent.length} chars, User query: ${query.length} chars, Total: ${finalQuery.length} chars`);
  } else {
    console.log(`FastGPT Query - User query only: ${finalQuery.length} chars`);
  }

  const MAX_QUERY_CHARS = 200000;
  if (finalQuery.length > MAX_QUERY_CHARS) {
    throw new Error(`Context too large (${finalQuery.length}). Reduce max context in settings.`);
  }

  let controller = null;
  try {
    controller = new AbortController();
    if (tabId != null) {
      const prev = activeControllers.get(tabId);
      if (prev) prev.abort();
      activeControllers.set(tabId, controller);
    }
  } catch {}
  
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
    }),
    signal: controller?.signal
  });
  
  if (tabId != null) {
    activeControllers.delete(tabId);
  }

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

// --- Context menu integration ---
try {
  if (browserAPI.runtime?.onInstalled) {
    browserAPI.runtime.onInstalled.addListener(() => {
      try {
        browserAPI.contextMenus?.removeAll?.();
        browserAPI.contextMenus?.create?.({
          id: 'kagi-fastgpt-selection',
          title: 'Ask Kagi FastGPT about selection',
          contexts: ['selection']
        });
        browserAPI.contextMenus?.create?.({
          id: 'kagi-fastgpt-page',
          title: 'Ask Kagi FastGPT about this page',
          contexts: ['page']
        });
      } catch {}
    });

    async function ensureInjected(tab) {
      if (!tab?.id || !tab.url) return;
      if (isRestrictedUrl(tab.url)) {
        await warnRestrictedSite(tab, 'The browser restricts extensions on this site.');
        return;
      }
      // Blocklist check
      try {
        const settings = await getSettings();
        const url = new URL(tab.url);
        const host = url.hostname;
        const blocked = Array.isArray(settings.blockedSites) ? settings.blockedSites : [];
        if (blocked.some((d) => d && host.endsWith(d))) {
          console.log('Kagi FastGPT: injection blocked for host', host);
          await warnRestrictedSite(tab, 'This site is in your blocklist.');
          return;
        }
      } catch {}

      let results;
      try {
        if (browserAPI.scripting?.executeScript) {
          results = await browserAPI.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                hasContent: typeof window.initKagiFastGPTSidebar === 'function',
                hasSidebar: !!document.getElementById('kagi-fastgpt-sidebar')
              };
            }
          });
        }
      } catch {}
      const pageState = results?.[0]?.result;
      if (!pageState?.hasContent) {
        await insertCSS({ tabId: tab.id }, ['sidebar.css']);
        await executeFiles({ tabId: tab.id }, ['content.js']);
      }
    }

    browserAPI.contextMenus?.onClicked?.addListener(async (info, tab) => {
      if (!tab?.id) return;
      if (info.menuItemId === 'kagi-fastgpt-selection' || info.menuItemId === 'kagi-fastgpt-page') {
        await ensureInjected(tab);
        try {
          await new Promise((resolve) => browserAPI.tabs.sendMessage(
            tab.id,
            { action: 'kagi_show_sidebar', mode: info.menuItemId, selectionText: info.selectionText || null },
            () => resolve()
          ));
        } catch {}
      }
    });
  }
} catch {}
