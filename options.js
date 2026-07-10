import {
  getRules,
  addRule,
  removeRule,
  updateRule,
  getSettings,
  setSettings,
  getShelf,
  clearShelf,
  getCategories,
  addCategory,
  removeCategory,
  updateCategory,
} from './shared/storage.js';

let rules = [];

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function actionBadge(action) {
  return `<span class="action-badge action-${action}">${action}</span>`;
}

function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ── Inline editing helpers ──

function makeTextEditable(td, ruleId, field, currentValue) {
  td.title = 'Double-click to edit';
  td.style.cursor = 'default';

  td.addEventListener('dblclick', () => {
    if (td.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = field === 'inactiveMinutes' ? 'number' : 'text';
    input.value = currentValue;
    input.className = 'input inline-input';
    if (field === 'inactiveMinutes') { input.min = 1; input.style.width = '70px'; }

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select();

    const commit = async () => {
      const raw = input.value.trim();
      if (field === 'inactiveMinutes') {
        const num = parseInt(raw, 10);
        if (isNaN(num) || num < 1) { renderRules(); return; }
        await updateRule(ruleId, { inactiveMinutes: num });
      } else {
        if (!raw) { renderRules(); return; }
        await updateRule(ruleId, { [field]: raw });
      }
      rules = await getRules();
      renderRules();
      showToast('Rule updated.');
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') renderRules();
    });
    input.addEventListener('blur', commit);
  });
}

function makeActionEditable(td, ruleId, currentAction) {
  td.title = 'Double-click to edit';

  td.addEventListener('dblclick', () => {
    if (td.querySelector('select')) return;

    const select = document.createElement('select');
    select.className = 'input inline-input';
    ['shelf', 'close', 'ignore'].forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (val === currentAction) opt.selected = true;
      select.appendChild(opt);
    });

    td.innerHTML = '';
    td.appendChild(select);
    select.focus();

    const commit = async () => {
      await updateRule(ruleId, { action: select.value });
      rules = await getRules();
      renderRules();
      showToast('Rule updated.');
    };

    select.addEventListener('change', commit);
    select.addEventListener('keydown', e => {
      if (e.key === 'Escape') renderRules();
    });
    select.addEventListener('blur', () => setTimeout(renderRules, 150));
  });
}

// ── Render ──

function renderRules() {
  const tbody = document.getElementById('rulesBody');
  tbody.innerHTML = '';

  if (rules.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="text-align:center;color:var(--text-secondary);padding:20px">No rules yet.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const rule of rules) {
    const tr = document.createElement('tr');

    const tdDomain = document.createElement('td');
    tdDomain.textContent = rule.domain;

    const tdAction = document.createElement('td');
    tdAction.innerHTML = actionBadge(rule.action);

    const tdMinutes = document.createElement('td');
    tdMinutes.textContent = formatMinutes(rule.inactiveMinutes);

    const tdDelete = document.createElement('td');
    tdDelete.innerHTML = `
      <button class="icon-btn-sm" data-id="${rule.id}" title="Delete">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>`;

    tr.appendChild(tdDomain);
    tr.appendChild(tdAction);
    tr.appendChild(tdMinutes);
    tr.appendChild(tdDelete);
    tbody.appendChild(tr);

    makeTextEditable(tdDomain, rule.id, 'domain', rule.domain);
    makeActionEditable(tdAction, rule.id, rule.action);
    makeTextEditable(tdMinutes, rule.id, 'inactiveMinutes', rule.inactiveMinutes);

    tdDelete.querySelector('[data-id]').addEventListener('click', async () => {
      await removeRule(rule.id);
      rules = await getRules();
      renderRules();
      showToast('Rule deleted.');
    });
  }
}

// ── Categories ──

async function renderCategories() {
  const cats = await getCategories();
  const container = document.getElementById('categoriesList');
  if (!container) return;
  container.innerHTML = '';

  for (const cat of cats) {
    const card = document.createElement('div');
    card.className = 'category-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'category-card-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'category-card-name';
    nameEl.textContent = cat.name;
    nameEl.title = 'Double-click to rename';
    nameEl.addEventListener('dblclick', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = cat.name;
      input.className = 'input inline-input';
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = async () => {
        const val = input.value.trim();
        if (val && val !== cat.name) {
          await updateCategory(cat.id, { name: val });
        }
        renderCategories();
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') renderCategories(); });
      input.addEventListener('blur', commit);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn-sm';
    delBtn.title = 'Delete category';
    delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    delBtn.addEventListener('click', async () => {
      await removeCategory(cat.id);
      renderCategories();
      showToast('Category deleted.');
    });

    cardHeader.appendChild(nameEl);
    cardHeader.appendChild(delBtn);

    const domainsEl = document.createElement('div');
    domainsEl.className = 'category-domains';

    const renderChips = (domains) => {
      domainsEl.innerHTML = '';
      for (const d of domains) {
        const chip = document.createElement('span');
        chip.className = 'domain-chip';
        chip.textContent = d;
        const x = document.createElement('button');
        x.textContent = '×';
        x.addEventListener('click', async () => {
          const updated = cat.domains.filter(v => v !== d);
          await updateCategory(cat.id, { domains: updated });
          cat.domains = updated;
          renderChips(updated);
        });
        chip.appendChild(x);
        domainsEl.appendChild(chip);
      }
      const addRow = document.createElement('div');
      addRow.className = 'add-domain-row';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'input';
      inp.placeholder = 'add domain...';
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary';
      addBtn.style.cssText = 'padding:2px 8px;font-size:11px;height:26px';
      addBtn.textContent = '+';
      const addDomain = async () => {
        const val = inp.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (!val) return;
        if (cat.domains.includes(val)) { showToast('Domain already in category.'); return; }
        const updated = [...cat.domains, val];
        await updateCategory(cat.id, { domains: updated });
        cat.domains = updated;
        inp.value = '';
        renderChips(updated);
      };
      addBtn.addEventListener('click', addDomain);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') addDomain(); });
      addRow.appendChild(inp);
      addRow.appendChild(addBtn);
      domainsEl.appendChild(addRow);
    };
    renderChips(cat.domains);

    card.appendChild(cardHeader);
    card.appendChild(domainsEl);
    container.appendChild(card);
  }
}

async function renderShelfStats() {
  const shelf = await getShelf();
  const domains = new Set(shelf.map(s => s.domain)).size;
  document.getElementById('shelfCount').textContent = shelf.length;
  document.getElementById('shelfDomains').textContent = domains;
}

async function init() {
  rules = await getRules();
  renderRules();
  await renderCategories();

  const { enabled, retentionDays, defaultAction, defaultInactiveMinutes } = await getSettings();
  document.getElementById('enabledToggle').checked = enabled;
  document.getElementById('retentionDays').value = String(retentionDays);
  document.getElementById('defaultAction').value = defaultAction;
  document.getElementById('defaultInactiveMinutes').value = String(defaultInactiveMinutes);
  document.getElementById('defaultInactiveMinutes').style.display = defaultAction === 'none' ? 'none' : '';

  await renderShelfStats();
}

document.getElementById('enabledToggle').addEventListener('change', async e => {
  await setSettings({ enabled: e.target.checked });
  showToast(e.target.checked ? 'Extension enabled.' : 'Extension disabled.');
});

document.getElementById('retentionDays').addEventListener('change', async e => {
  await setSettings({ retentionDays: Number(e.target.value) });
  showToast('Retention period saved.');
});

document.getElementById('defaultAction').addEventListener('change', async e => {
  const action = e.target.value;
  const minutesEl = document.getElementById('defaultInactiveMinutes');
  minutesEl.style.display = action === 'none' ? 'none' : '';
  await setSettings({ defaultAction: action });
  showToast('Default action saved.');
});

document.getElementById('defaultInactiveMinutes').addEventListener('change', async e => {
  const val = parseInt(e.target.value, 10);
  if (isNaN(val) || val < 1) { showToast('Idle time must be at least 1 minute.'); return; }
  await setSettings({ defaultInactiveMinutes: val });
  showToast('Default idle time saved.');
});

document.getElementById('addCategoryBtn').addEventListener('click', async () => {
  const name = document.getElementById('newCategoryName').value.trim();
  if (!name) { showToast('Enter a category name.'); return; }
  await addCategory({ id: crypto.randomUUID(), name, domains: [] });
  document.getElementById('newCategoryName').value = '';
  await renderCategories();
  showToast('Category added.');
});

document.getElementById('addRuleBtn').addEventListener('click', async () => {
  const domain = document.getElementById('newDomain').value.trim();
  const action = document.getElementById('newAction').value;
  const inactiveMinutes = parseInt(document.getElementById('newMinutes').value, 10);

  if (!domain) { showToast('Enter a domain.'); return; }
  if (isNaN(inactiveMinutes) || inactiveMinutes < 1) { showToast('Idle time must be at least 1 minute.'); return; }
  if (rules.some(r => r.domain === domain)) { showToast('A rule for this domain already exists.'); return; }

  await addRule({ id: crypto.randomUUID(), domain, action, inactiveMinutes });
  rules = await getRules();
  renderRules();
  document.getElementById('newDomain').value = '';
  showToast('Rule added.');
});

document.getElementById('clearShelfBtn').addEventListener('click', async () => {
  const shelf = await getShelf();
  if (shelf.length === 0) { showToast('Shelf is already empty.'); return; }
  if (!confirm('Clear the entire shelf?')) return;
  await clearShelf();
  await renderShelfStats();
  showToast('Shelf cleared.');
});

init();
