// Default rules applied on first install
const DEFAULT_RULES = [
  { id: 'r1', domain: 'mail.google.com', action: 'close', inactiveMinutes: 120 },
  { id: 'r2', domain: 'calendar.google.com', action: 'close', inactiveMinutes: 120 },
  { id: 'r3', domain: 'arxiv.org', action: 'shelf', inactiveMinutes: 240 },
  { id: 'r4', domain: 'www.nature.com', action: 'shelf', inactiveMinutes: 240 },
  { id: 'r5', domain: 'www.sciencedirect.com', action: 'shelf', inactiveMinutes: 240 },
  { id: 'r6', domain: 'www.biorxiv.org', action: 'shelf', inactiveMinutes: 240 },
];

const DEFAULT_SETTINGS = {
  enabled: true,
  retentionDays: 30,
  defaultAction: 'none',
  defaultInactiveMinutes: 60,
};

export async function getRules() {
  const { rules } = await chrome.storage.local.get('rules');
  return rules ?? DEFAULT_RULES;
}

export async function setRules(rules) {
  await chrome.storage.local.set({ rules });
}

export async function addRule(rule) {
  const rules = await getRules();
  rules.push(rule);
  await setRules(rules);
}

export async function removeRule(id) {
  const rules = await getRules();
  await setRules(rules.filter(r => r.id !== id));
}

export async function updateRule(id, patch) {
  const rules = await getRules();
  await setRules(rules.map(r => r.id === id ? { ...r, ...patch } : r));
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function setSettings(patch) {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...patch } });
}

export async function getShelf() {
  const { shelf } = await chrome.storage.local.get('shelf');
  return shelf ?? [];
}

export async function addToShelf(item) {
  const shelf = await getShelf();
  // Dedup by URL
  if (shelf.some(s => s.url === item.url)) return;
  shelf.push(item);
  await chrome.storage.local.set({ shelf });
}

export async function removeFromShelf(id) {
  const shelf = await getShelf();
  await chrome.storage.local.set({ shelf: shelf.filter(s => s.id !== id) });
}

export async function removeFromShelfByUrl(url) {
  const shelf = await getShelf();
  await chrome.storage.local.set({ shelf: shelf.filter(s => s.url !== url) });
}

export async function removeDomainFromShelf(domain) {
  const shelf = await getShelf();
  await chrome.storage.local.set({ shelf: shelf.filter(s => s.domain !== domain) });
}

export async function clearShelf() {
  await chrome.storage.local.set({ shelf: [] });
}

export async function pruneShelf() {
  const { retentionDays } = await getSettings();
  if (retentionDays === 0) return; // Keep forever
  const shelf = await getShelf();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pruned = shelf.filter(s => s.shelvedAt >= cutoff);
  if (pruned.length !== shelf.length) {
    await chrome.storage.local.set({ shelf: pruned });
  }
}

export async function getCategories() {
  const { categories } = await chrome.storage.local.get('categories');
  return categories ?? [];
}

export async function setCategories(cats) {
  await chrome.storage.local.set({ categories: cats });
}

export async function addCategory(cat) {
  const cats = await getCategories();
  cats.push(cat);
  await setCategories(cats);
}

export async function removeCategory(id) {
  const cats = await getCategories();
  await setCategories(cats.filter(c => c.id !== id));
}

export async function updateCategory(id, patch) {
  const cats = await getCategories();
  await setCategories(cats.map(c => c.id === id ? { ...c, ...patch } : c));
}

// Tab last-active timestamps in session storage (survives SW restart resets)
export async function getTabActivity() {
  const { tabActivity } = await chrome.storage.session.get('tabActivity');
  return tabActivity ?? {};
}

export async function setTabActive(tabId) {
  const activity = await getTabActivity();
  activity[tabId] = Date.now();
  await chrome.storage.session.set({ tabActivity: activity });
}

export async function removeTabActivity(tabId) {
  const activity = await getTabActivity();
  delete activity[tabId];
  await chrome.storage.session.set({ tabActivity: activity });
}

export async function removeMultipleFromShelf(ids) {
  const idSet = new Set(ids);
  const shelf = await getShelf();
  await chrome.storage.local.set({ shelf: shelf.filter(s => !idSet.has(s.id)) });
}

export async function exportData() {
  const [rules, categories, settings, shelf] = await Promise.all([
    getRules(), getCategories(), getSettings(), getShelf(),
  ]);
  return { rules, categories, settings, shelf };
}

export async function importData({ rules, categories, settings, shelf }) {
  const writes = {};
  if (Array.isArray(rules)) writes.rules = rules;
  if (Array.isArray(categories)) writes.categories = categories;
  if (settings && typeof settings === 'object') writes.settings = { ...DEFAULT_SETTINGS, ...settings };
  if (Array.isArray(shelf)) writes.shelf = shelf;
  await chrome.storage.local.set(writes);
}
