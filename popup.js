import {
  getShelf,
  getRules,
  addRule,
  addToShelf,
  getCategories,
  updateCategory,
  removeFromShelf,
  removeMultipleFromShelf,
  clearShelf,
} from './shared/storage.js';

const IGNORED_SCHEMES = ['chrome:', 'chrome-extension:', 'about:', 'data:', 'file:'];
function isIgnoredUrl(url) {
  if (!url) return true;
  return IGNORED_SCHEMES.some(s => url.startsWith(s));
}

function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const ITEMS_PER_GROUP = 5;

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

function faviconImg(src, cls) {
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.className = cls;
    img.onerror = () => {
      const div = document.createElement('div');
      div.className = cls.replace('tab-favicon', 'tab-favicon-fallback').replace('domain-favicon', 'domain-favicon-fallback');
      img.replaceWith(div);
    };
    return img;
  }
  const div = document.createElement('div');
  div.className = cls.includes('domain') ? 'domain-favicon-fallback' : 'tab-favicon-fallback';
  return div;
}

function buildTabItem(item, onRemove, showDomain = false) {
  const row = document.createElement('div');
  row.className = 'tab-item';
  row.title = item.title;

  row.appendChild(faviconImg(item.favicon, 'tab-favicon'));

  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = item.title || item.url;

  const time = document.createElement('div');
  time.className = 'tab-time';
  const timeText = item.inactiveDuration
    ? `idle ${formatDuration(item.inactiveDuration)} · ${relativeTime(item.shelvedAt)}`
    : relativeTime(item.shelvedAt);
  time.textContent = showDomain ? `${item.domain} · ${timeText}` : timeText;

  info.appendChild(title);
  info.appendChild(time);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'tab-remove';
  removeBtn.title = 'Remove from shelf';
  removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  removeBtn.addEventListener('click', e => { e.stopPropagation(); onRemove(item); });

  row.appendChild(info);
  row.appendChild(removeBtn);
  row.addEventListener('click', () => { chrome.tabs.create({ url: item.url }); onRemove(item); });

  return row;
}

function buildGroup({ label, isCategory, items }, filter, onRemove, onRestoreGroup, onDismissGroup) {
  const group = document.createElement('div');
  group.className = 'domain-group';

  const header = document.createElement('div');
  header.className = 'domain-header';

  const chevron = document.createElement('span');
  chevron.className = 'domain-chevron';
  chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;

  // Category shows folder icon, domain shows favicon
  let iconEl;
  if (isCategory) {
    const iconWrap = document.createElement('span');
    iconWrap.className = 'domain-favicon-fallback category-icon';
    iconWrap.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    iconEl = iconWrap;
  } else {
    iconEl = faviconImg(items[0]?.favicon, 'domain-favicon');
  }

  const name = document.createElement('span');
  name.className = 'domain-name';
  name.textContent = label;

  const badge = document.createElement('span');
  badge.className = 'domain-badge';
  badge.textContent = items.length;

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'domain-restore-btn';
  restoreBtn.textContent = 'Restore all';
  restoreBtn.addEventListener('click', e => { e.stopPropagation(); onRestoreGroup(items); });

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'domain-dismiss-btn';
  dismissBtn.title = 'Dismiss all without restoring';
  dismissBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  dismissBtn.addEventListener('click', e => { e.stopPropagation(); onDismissGroup(items); });

  header.appendChild(chevron);
  header.appendChild(iconEl);
  header.appendChild(name);
  header.appendChild(badge);
  header.appendChild(restoreBtn);
  header.appendChild(dismissBtn);

  const tabItems = document.createElement('div');
  tabItems.className = 'tab-items';

  const visibleItems = filter ? items : items.slice(0, ITEMS_PER_GROUP);
  const hiddenCount = filter ? 0 : items.length - ITEMS_PER_GROUP;

  visibleItems.forEach(item => tabItems.appendChild(buildTabItem(item, onRemove, isCategory)));

  if (hiddenCount > 0) {
    const more = document.createElement('div');
    more.className = 'show-more';
    more.textContent = `+ ${hiddenCount} more`;
    more.addEventListener('click', () => {
      items.slice(ITEMS_PER_GROUP).forEach(item => {
        tabItems.insertBefore(buildTabItem(item, onRemove, isCategory), more);
      });
      more.remove();
    });
    tabItems.appendChild(more);
  }

  group.appendChild(header);
  group.appendChild(tabItems);

  header.addEventListener('click', () => {
    group.classList.toggle('expanded');
    document.getElementById('moveToCatDropdown').style.display = 'none';
    const anyExpanded = document.querySelectorAll('.domain-group.expanded').length > 0;
    const sel = document.getElementById('selectionActions');
    const moveBtn = document.getElementById('moveToCatBtn');
    if (sel) sel.style.display = anyExpanded ? 'flex' : 'none';
    if (moveBtn) {
      moveBtn.disabled = categoriesData.length === 0;
      moveBtn.dataset.tooltip = categoriesData.length === 0
        ? 'No categories — add one in Settings'
        : 'Move to category';
    }
  });

  return group;
}

let shelfData = [];
let categoriesData = [];
let searchQuery = '';

async function loadShelf() {
  [shelfData, categoriesData] = await Promise.all([getShelf(), getCategories()]);
  render();
}

function groupItems(items, categories) {
  const map = new Map();
  for (const item of items) {
    const cat = categories.find(c => c.domains.includes(item.domain));
    if (cat) {
      const key = `cat:${cat.id}`;
      if (!map.has(key)) map.set(key, { label: cat.name, isCategory: true, items: [] });
      map.get(key).items.push(item);
    } else {
      const key = `dom:${item.domain || 'unknown'}`;
      if (!map.has(key)) map.set(key, { label: item.domain || 'unknown', isCategory: false, items: [] });
      map.get(key).items.push(item);
    }
  }
  return map;
}

function filterShelf(items, query) {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(i =>
    (i.title || '').toLowerCase().includes(q) ||
    (i.url || '').toLowerCase().includes(q)
  );
}

function renderStats(total, groups) {
  document.getElementById('statTabCount').textContent = total;
  document.getElementById('statDomainCount').textContent = groups.size;
}

function getExpandedGroups() {
  const expanded = new Set();
  document.querySelectorAll('.domain-group.expanded .domain-name').forEach(el => {
    expanded.add(el.textContent);
  });
  return expanded;
}

function render(expandedGroups) {
  const list = document.getElementById('shelfList');
  const prevExpanded = expandedGroups ?? getExpandedGroups();
  list.innerHTML = '';

  const filtered = filterShelf(shelfData, searchQuery);
  const groups = groupItems(filtered, categoriesData);

  renderStats(shelfData.length, groupItems(shelfData, categoriesData));

  if (groups.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
      <p>${searchQuery ? 'No results.' : 'Shelf is empty.'}</p>
    `;
    list.appendChild(empty);
    const sel = document.getElementById('selectionActions');
    if (sel) sel.style.display = 'none';
    return;
  }

  let anyExpanded = false;
  for (const [, groupInfo] of groups) {
    const shouldExpand = !!searchQuery || prevExpanded.has(groupInfo.label);
    if (shouldExpand) anyExpanded = true;

    const group = buildGroup(
      groupInfo,
      !!searchQuery,
      async item => {
        const exp = getExpandedGroups();
        await removeFromShelf(item.id);
        shelfData = shelfData.filter(s => s.id !== item.id);
        render(exp);
      },
      async items => {
        const exp = getExpandedGroups();
        exp.delete(groupInfo.label);
        chrome.windows.create({ url: items.map(i => i.url) });
        const ids = new Set(items.map(i => i.id));
        for (const item of items) await removeFromShelf(item.id);
        shelfData = shelfData.filter(s => !ids.has(s.id));
        render(exp);
      },
      async items => {
        const exp = getExpandedGroups();
        exp.delete(groupInfo.label);
        const ids = new Set(items.map(i => i.id));
        for (const item of items) await removeFromShelf(item.id);
        shelfData = shelfData.filter(s => !ids.has(s.id));
        render(exp);
      }
    );
    if (shouldExpand) group.classList.add('expanded');
    list.appendChild(group);
  }

  const sel = document.getElementById('selectionActions');
  const moveBtn = document.getElementById('moveToCatBtn');
  if (sel) sel.style.display = anyExpanded ? 'flex' : 'none';
  if (moveBtn) {
    moveBtn.disabled = categoriesData.length === 0;
    moveBtn.dataset.tooltip = categoriesData.length === 0
      ? 'No categories — add one in Settings'
      : 'Move to category';
  }
}

// --- Event listeners ---

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('saveTabBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || isIgnoredUrl(tab.url)) return;
  await addToShelf({
    id: crypto.randomUUID(),
    url: tab.url,
    title: tab.title || tab.url,
    domain: getDomain(tab.url),
    favicon: tab.favIconUrl || '',
    shelvedAt: Date.now(),
    inactiveDuration: 0,
  });
  chrome.tabs.remove(tab.id).catch(() => {});
  shelfData = await getShelf();
  render();
});

// Collapse all expanded groups (no data change)
document.getElementById('collapseAllBtn').addEventListener('click', () => {
  document.getElementById('moveToCatDropdown').style.display = 'none';
  render(new Set());
});

// Move to category dropdown
document.getElementById('moveToCatBtn').addEventListener('click', e => {
  e.stopPropagation();
  const dropdown = document.getElementById('moveToCatDropdown');
  if (dropdown.style.display !== 'none') {
    dropdown.style.display = 'none';
    return;
  }
  dropdown.innerHTML = '';
  const hdr = document.createElement('div');
  hdr.className = 'move-cat-header';
  hdr.textContent = 'Move to category';
  dropdown.appendChild(hdr);

  const expanded = getExpandedGroups();
  const hasExpandedCategory = categoriesData.some(c => expanded.has(c.name));

  if (hasExpandedCategory) {
    const err = document.createElement('div');
    err.className = 'move-cat-empty';
    err.style.color = 'var(--danger)';
    err.textContent = 'Categories cannot be nested';
    dropdown.appendChild(err);
  } else if (categoriesData.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'move-cat-empty';
    empty.textContent = 'No categories defined';
    dropdown.appendChild(empty);
  } else {
    for (const cat of categoriesData) {
      const item = document.createElement('div');
      item.className = 'move-cat-item';
      item.textContent = cat.name;
      item.addEventListener('click', async () => {
        dropdown.style.display = 'none';
        await moveSelectedToCategory(cat);
      });
      dropdown.appendChild(item);
    }
  }
  dropdown.style.display = 'block';
});

async function moveSelectedToCategory(cat) {
  const expanded = getExpandedGroups();
  if (categoriesData.some(c => expanded.has(c.name))) return;
  const domains = new Set();
  for (const item of shelfData) {
    const groupCat = categoriesData.find(c => c.domains.includes(item.domain));
    const label = groupCat ? groupCat.name : item.domain;
    if (expanded.has(label)) domains.add(item.domain);
  }
  const merged = [...new Set([...cat.domains, ...domains])];
  await updateCategory(cat.id, { domains: merged });
  categoriesData = await getCategories();
  render(getExpandedGroups());
}

// Add auto-close rule for expanded domains
document.getElementById('closeSelectedBtn').addEventListener('click', async () => {
  const expanded = getExpandedGroups();
  const existingRules = await getRules();
  const domains = new Set();
  for (const item of shelfData) {
    const cat = categoriesData.find(c => c.domains.includes(item.domain));
    const label = cat ? cat.name : item.domain;
    if (expanded.has(label)) domains.add(item.domain);
  }
  const idsToRemove = shelfData.filter(s => domains.has(s.domain)).map(s => s.id);
  await removeMultipleFromShelf(idsToRemove);
  for (const domain of domains) {
    if (!existingRules.some(r => r.domain === domain)) {
      await addRule({ id: crypto.randomUUID(), domain, action: 'close', inactiveMinutes: 60 });
    }
  }
  const idSet = new Set(idsToRemove);
  shelfData = shelfData.filter(s => !idSet.has(s.id));
  render(new Set());
});

// Remove selected from shelf without restoring
document.getElementById('dismissSelectedBtn').addEventListener('click', async () => {
  const expanded = getExpandedGroups();
  const idsToRemove = shelfData
    .filter(s => {
      const cat = categoriesData.find(c => c.domains.includes(s.domain));
      return expanded.has(cat ? cat.name : s.domain);
    })
    .map(s => s.id);
  await removeMultipleFromShelf(idsToRemove);
  const idSet = new Set(idsToRemove);
  shelfData = shelfData.filter(s => !idSet.has(s.id));
  render(new Set());
});

document.addEventListener('click', () => {
  document.getElementById('moveToCatDropdown').style.display = 'none';
});

document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (searchQuery) {
      const input = document.getElementById('searchInput');
      input.value = '';
      searchQuery = '';
      render();
      input.focus();
    } else if (getExpandedGroups().size > 0) {
      render(new Set());
    }
  }
});

document.getElementById('restoreAllBtn').addEventListener('click', async () => {
  if (shelfData.length === 0) return;
  chrome.windows.create({ url: shelfData.map(i => i.url) });
  await clearShelf();
  shelfData = [];
  render();
});

document.getElementById('clearAllBtn').addEventListener('click', async () => {
  if (!confirm('Clear the entire shelf?')) return;
  await clearShelf();
  shelfData = [];
  render();
});

document.getElementById('shelfAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('shelfAllBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  const win = await chrome.windows.getCurrent();
  chrome.runtime.sendMessage({ type: 'SHELF_ALL_TABS', windowId: win.id }, async () => {
    shelfData = await getShelf();
    render();
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Shelf All Tabs`;
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.categories) {
    categoriesData = changes.categories.newValue ?? [];
    render();
  }
  if (changes.shelf) {
    shelfData = changes.shelf.newValue ?? [];
    render();
  }
});

loadShelf();
