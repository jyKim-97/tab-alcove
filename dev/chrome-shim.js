// Chrome Extension API shim for local UI preview (no extension install needed)
// Loaded before popup.js / options.js when opened via dev/preview-*.html

const DUMMY_SHELF = [
  { id: '1', url: 'https://arxiv.org/abs/1706.03762', title: 'Attention Is All You Need', domain: 'arxiv.org', favicon: 'https://arxiv.org/favicon.ico', shelvedAt: Date.now() - 2 * 3600_000, inactiveDuration: 5.2 * 3600_000 },
  { id: '2', url: 'https://arxiv.org/abs/2001.08361', title: 'Scaling Laws for Neural Language Models', domain: 'arxiv.org', favicon: 'https://arxiv.org/favicon.ico', shelvedAt: Date.now() - 5 * 3600_000, inactiveDuration: 4 * 3600_000 },
  { id: '3', url: 'https://arxiv.org/abs/2005.14165', title: 'Language Models are Few-Shot Learners (GPT-3)', domain: 'arxiv.org', favicon: 'https://arxiv.org/favicon.ico', shelvedAt: Date.now() - 8 * 3600_000, inactiveDuration: 6.5 * 3600_000 },
  { id: '4', url: 'https://arxiv.org/abs/2303.08774', title: 'GPT-4 Technical Report', domain: 'arxiv.org', favicon: 'https://arxiv.org/favicon.ico', shelvedAt: Date.now() - 26 * 3600_000, inactiveDuration: 4 * 3600_000 },
  { id: '5', url: 'https://arxiv.org/abs/2204.01691', title: 'Training Compute-Optimal Large Language Models', domain: 'arxiv.org', favicon: 'https://arxiv.org/favicon.ico', shelvedAt: Date.now() - 50 * 3600_000, inactiveDuration: 8 * 3600_000 },
  { id: '6', url: 'https://www.nature.com/articles/s41586-021-03819-2', title: 'Highly accurate protein structure prediction with AlphaFold', domain: 'www.nature.com', favicon: 'https://www.nature.com/favicon.ico', shelvedAt: Date.now() - 1 * 3600_000, inactiveDuration: 4.5 * 3600_000 },
  { id: '7', url: 'https://www.nature.com/articles/s41586-023-06647-8', title: 'Accurate structure prediction of biomolecular interactions with AlphaFold 3', domain: 'www.nature.com', favicon: 'https://www.nature.com/favicon.ico', shelvedAt: Date.now() - 3 * 24 * 3600_000, inactiveDuration: 4 * 3600_000 },
  { id: '8', url: 'https://www.biorxiv.org/content/10.1101/2023.07.09.548154v1', title: 'ESMFold: Evolutionary Scale Modeling for Protein Structure', domain: 'www.biorxiv.org', favicon: '', shelvedAt: Date.now() - 10 * 3600_000, inactiveDuration: 5 * 3600_000 },
  { id: '9', url: 'https://www.sciencedirect.com/science/article/pii/S0092867421005456', title: 'Reservoir computing with noise', domain: 'www.sciencedirect.com', favicon: '', shelvedAt: Date.now() - 2 * 24 * 3600_000, inactiveDuration: 7.5 * 3600_000 },
];

const DUMMY_RULES = [
  { id: 'r1', domain: 'mail.google.com', action: 'close', inactiveMinutes: 120 },
  { id: 'r2', domain: 'calendar.google.com', action: 'close', inactiveMinutes: 120 },
  { id: 'r3', domain: 'arxiv.org', action: 'shelf', inactiveMinutes: 240 },
  { id: 'r4', domain: 'www.nature.com', action: 'shelf', inactiveMinutes: 240 },
  { id: 'r5', domain: 'www.sciencedirect.com', action: 'shelf', inactiveMinutes: 240 },
  { id: 'r6', domain: 'www.biorxiv.org', action: 'shelf', inactiveMinutes: 240 },
];

const DUMMY_CATEGORIES = [
  { id: 'cat1', name: 'Papers', domains: ['arxiv.org', 'www.nature.com', 'www.biorxiv.org', 'www.sciencedirect.com'] },
];

// In-memory store so mutations (add/remove) work in the preview
const store = {
  shelf: JSON.parse(JSON.stringify(DUMMY_SHELF)),
  rules: JSON.parse(JSON.stringify(DUMMY_RULES)),
  settings: { enabled: true, retentionDays: 30, defaultAction: 'none', defaultInactiveMinutes: 60 },
  categories: JSON.parse(JSON.stringify(DUMMY_CATEGORIES)),
};

function asyncify(value) {
  return { then(fn) { setTimeout(() => fn(value), 0); return Promise.resolve(value); } };
}

// Minimal chrome.storage.local / session shim
function makeStorage(namespace) {
  const _store = {};
  return {
    get(keys, cb) {
      const result = {};
      (Array.isArray(keys) ? keys : [keys]).forEach(k => { if (k in _store) result[k] = _store[k]; });
      const p = Promise.resolve(result);
      if (cb) p.then(cb);
      return p;
    },
    set(obj, cb) {
      Object.assign(_store, obj);
      const p = Promise.resolve();
      if (cb) p.then(cb);
      return p;
    },
  };
}

// Seed storage with dummy data
const _local = makeStorage('local');
const _session = makeStorage('session');
_local.set({ shelf: store.shelf, rules: store.rules, settings: store.settings, categories: store.categories });

window.chrome = {
  storage: {
    local: _local,
    session: _session,
  },
  tabs: {
    create({ url }) {
      console.log('[shim] chrome.tabs.create', url);
      window.open(url, '_blank');
    },
    query(filter, cb) {
      const fakeTab = { id: 999, url: 'https://example.com/page', title: 'Example Page', favIconUrl: '' };
      const result = [fakeTab];
      const p = Promise.resolve(result);
      if (cb) p.then(cb);
      return p;
    },
    remove(tabId) {
      console.log('[shim] chrome.tabs.remove', tabId);
    },
  },
  windows: {
    create({ url: urls }) {
      console.log('[shim] chrome.windows.create', urls);
      if (Array.isArray(urls)) urls.forEach(u => window.open(u, '_blank'));
      else window.open(urls, '_blank');
    },
  },
  runtime: {
    openOptionsPage() {
      console.log('[shim] chrome.runtime.openOptionsPage');
      window.open('preview-options.html', '_blank');
    },
    sendMessage(msg, cb) {
      console.log('[shim] chrome.runtime.sendMessage', msg);
      if (msg.type === 'SHELF_ALL_TABS') {
        // In preview: simulate shelving 3 fake "open tabs"
        const fakeTabs = [
          { id: 'f1', url: 'https://github.com/trending', title: 'Trending repositories · GitHub', domain: 'github.com', favicon: '', shelvedAt: Date.now() },
          { id: 'f2', url: 'https://news.ycombinator.com', title: 'Hacker News', domain: 'news.ycombinator.com', favicon: '', shelvedAt: Date.now() },
          { id: 'f3', url: 'https://arxiv.org/abs/2406.99999', title: 'A New Preprint · arxiv.org', domain: 'arxiv.org', favicon: 'https://arxiv.org/favicon.ico', shelvedAt: Date.now() },
        ];
        // Add to in-memory shelf
        _local.get(['shelf'], ({ shelf = [] }) => {
          const deduped = fakeTabs.filter(t => !shelf.some(s => s.url === t.url));
          _local.set({ shelf: [...shelf, ...deduped] }, () => {
            if (cb) setTimeout(() => cb({ count: deduped.length }), 300);
          });
        });
      } else {
        if (cb) setTimeout(() => cb({}), 0);
      }
    },
    lastError: null,
  },
  contextMenus: {
    create() {},
    removeAll(cb) { if (cb) cb(); },
  },
  alarms: {
    create() {},
    onAlarm: { addListener() {} },
  },
};
