import {
  getRules,
  getCategories,
  getSettings,
  getShelf,
  addToShelf,
  getTabActivity,
  setTabActive,
  removeTabActivity,
  pruneShelf,
} from './shared/storage.js';

const IGNORED_SCHEMES = ['chrome:', 'chrome-extension:', 'about:', 'data:', 'file:'];

function isIgnoredUrl(url) {
  if (!url) return true;
  return IGNORED_SCHEMES.some(s => url.startsWith(s));
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Priority: individual domain rule > category rule > null
function resolveRule(rules, categories, domain) {
  const domainRule = rules.find(r => r.domain === domain);
  if (domainRule) return domainRule;
  const cat = categories.find(c => c.domains.includes(domain));
  if (cat?.rule) return cat.rule;
  return null;
}

async function sendToShelf(tab, inactiveDuration = 0) {
  const favicon = tab.favIconUrl || '';
  await addToShelf({
    id: crypto.randomUUID(),
    url: tab.url,
    title: tab.title || tab.url,
    domain: getDomain(tab.url),
    favicon,
    shelvedAt: Date.now(),
    inactiveDuration,
  });
}

async function checkInactiveTabs() {
  const settings = await getSettings();
  if (!settings.enabled) return;

  const [rules, categories] = await Promise.all([getRules(), getCategories()]);
  const activity = await getTabActivity();
  const now = Date.now();

  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (tab.pinned) continue;
    if (isIgnoredUrl(tab.url)) continue;

    const domain = getDomain(tab.url);
    if (!domain) continue;

    const rule = resolveRule(rules, categories, domain);

    let action, thresholdMs;
    if (rule) {
      if (rule.action === 'ignore') continue;
      action = rule.action;
      thresholdMs = rule.inactiveMinutes * 60 * 1000;
    } else if (settings.defaultAction !== 'none') {
      action = settings.defaultAction;
      thresholdMs = settings.defaultInactiveMinutes * 60 * 1000;
    } else {
      continue;
    }

    // Use tracked activity, fall back to Chrome's lastAccessed
    const lastActive = activity[tab.id] ?? tab.lastAccessed ?? now;
    const inactiveMs = now - lastActive;

    if (inactiveMs < thresholdMs) continue;

    if (action === 'shelf') {
      await sendToShelf(tab, inactiveMs);
    }
    chrome.tabs.remove(tab.id).catch(() => {});
    await removeTabActivity(tab.id);
  }

  await pruneShelf();
}

// --- Event listeners ---

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  chrome.alarms.create('tab-shelf-check', { periodInMinutes: 1 });
  // Enable side panel on all tabs by default
  chrome.sidePanel.setOptions({ enabled: true });
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

// Open side panel when toolbar icon is clicked
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Recreate context menu after SW wakes up (it may have been cleared)
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'tab-shelf-check') {
    await checkInactiveTabs();
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await setTabActive(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    await setTabActive(tabId);
  }
});

chrome.tabs.onRemoved.addListener(async tabId => {
  await removeTabActivity(tabId);
});

// Context menu: "Send to Shelf"
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'send-to-shelf',
      title: 'Send to Shelf',
      contexts: ['page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'send-to-shelf') return;
  if (!tab || isIgnoredUrl(tab.url)) return;

  await sendToShelf(tab);
  chrome.tabs.remove(tab.id).catch(() => {});
  await removeTabActivity(tab.id);
});

async function shelfAllOpenTabs(windowId) {
  const query = windowId ? { windowId } : {};
  const tabs = await chrome.tabs.query(query);
  let count = 0;
  for (const tab of tabs) {
    if (tab.pinned) continue;
    if (isIgnoredUrl(tab.url)) continue;
    await sendToShelf(tab);
    chrome.tabs.remove(tab.id).catch(() => {});
    await removeTabActivity(tab.id);
    count++;
  }
  return count;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'CHECK_NOW') {
    checkInactiveTabs().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'SHELF_ALL_TABS') {
    shelfAllOpenTabs(msg.windowId).then(count => sendResponse({ count }));
    return true;
  }
});
