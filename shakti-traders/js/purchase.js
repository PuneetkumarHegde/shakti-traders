/* ============================================================
   purchase.js — Purchase module (ledger-style: TSS / TMS / Total)
   --- MODIFIED ---
   * Per-day Sold Quantity fields removed from purchase entries.
   * Sold quantity is now a single overall total per type
     (TSS / TMS) entered manually on the Purchase Summary panel
     and stored in localStorage.
============================================================ */

const PurchaseState = {
  page: 1,
  pageSize: 8,
  search: '',
  filterDate: '',
  filterMonth: ''
};

/* ---------- Manual (overall) sold-quantity store ---------- */
const MANUAL_SOLD_KEY = 'st_manual_sold_v1';

function getManualSold() {
  try {
    const raw = localStorage.getItem(MANUAL_SOLD_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return { tss: Number(v.tss) || 0, tms: Number(v.tms) || 0 };
  } catch (_) {
    return { tss: 0, tms: 0 };
  }
}
function setManualSold(partial) {
  const cur = getManualSold();
  const next = { ...cur, ...partial };
  localStorage.setItem(MANUAL_SOLD_KEY, JSON.stringify(next));
  return next;
}

function calcPurchase({ tss_quantity, tss_amount, tms_quantity, tms_amount }) {
  const tssQ = Number(tss_quantity) || 0;
  const tssA = Number(tss_amount) || 0;
  const tmsQ = Number(tms_quantity) || 0;
  const tmsA = Number(tms_amount) || 0;

  const total_quantity = roundNum(tssQ + tmsQ);
  const total_amount   = roundNum(tssA + tmsA);

  const slnk_quantity = total_quantity;
  const slnk_amount   = roundNum(total_amount + (total_quantity * 4));

  return { total_quantity, total_amount, slnk_quantity, slnk_amount };
}

function purchaseFormHtml(record) {
  const r = record || {};
  return `
    <form id="purchaseForm">
      <label>Date
        <input type="date" id="p_date" value="${r.date || ''}" required>
      </label>

      <label>TSS Purchased Quantity
        <input type="number" step="any" id="p_tssq" value="${r.tss_quantity ?? ''}" required>
      </label>
      <label>TSS Amount
        <input type="number" step="any" id="p_tssa" value="${r.tss_amount ?? ''}" required>
      </label>

      <label>TMS Purchased Quantity
        <input type="number" step="any" id="p_tmsq" value="${r.tms_quantity ?? ''}" required>
      </label>
      <label>TMS Amount
        <input type="number" step="any" id="p_tmsa" value="${r.tms_amount ?? ''}" required>
      </label>

      <div class="calc-row" id="p_calc"></div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="purchaseCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${record ? 'Update' : 'Save'} Purchase</button>
      </div>
    </form>
  `;
}

function bindPurchaseFormEvents(editId) {
  const ids = ['p_tssq', 'p_tssa', 'p_tmsq', 'p_tmsa'];
  const inputs = ids.map(id => document.getElementById(id));

  function updateCalc() {
    const vals = calcPurchase({
      tss_quantity: document.getElementById('p_tssq').value,
      tss_amount:   document.getElementById('p_tssa').value,
      tms_quantity: document.getElementById('p_tmsq').value,
      tms_amount:   document.getElementById('p_tmsa').value
    });
    document.getElementById('p_calc').innerHTML =
      `Total Purchased: ${formatQty(vals.total_quantity)}<br>` +
      `Total Amount: ${formatCurrency(vals.total_amount)} &nbsp;|&nbsp; SLNK Amount: ${formatCurrency(vals.slnk_amount)}`;
  }
  inputs.forEach(inp => inp.addEventListener('input', updateCalc));
  updateCalc();

  document.getElementById('purchaseCancel').addEventListener('click', closeModal);

  document.getElementById('purchaseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const base = {
      date: document.getElementById('p_date').value,
      tss_quantity: Number(document.getElementById('p_tssq').value) || 0,
      tss_amount:   Number(document.getElementById('p_tssa').value) || 0,
      tms_quantity: Number(document.getElementById('p_tmsq').value) || 0,
      tms_amount:   Number(document.getElementById('p_tmsa').value) || 0,
      // legacy fields kept zero so downstream code stays compatible
      tss_sold_quantity: 0,
      tms_sold_quantity: 0
    };
    const calc = calcPurchase(base);
    const record = {
      ...base,
      ...calc,
      tss_remaining_quantity: base.tss_quantity,
      tms_remaining_quantity: base.tms_quantity,
      total_sold_quantity: 0,
      total_remaining_quantity: calc.total_quantity
    };

    showLoading(true);
    setTimeout(() => {
      if (editId) {
        DB.update('purchase', editId, record);
        toast('Purchase entry updated successfully.');
      } else {
        DB.insert('purchase', record);
        toast('Purchase entry added successfully.');
      }
      showLoading(false);
      closeModal();
      PurchaseState.page = 1;
      renderPurchaseTable();
      refreshDashboard();
    }, 250);
  });
}

document.getElementById('addPurchaseBtn').addEventListener('click', () => {
  openModal('Add Purchase', purchaseFormHtml(null));
  bindPurchaseFormEvents(null);
});

function editPurchase(id) {
  const record = DB.getById('purchase', id);
  if (!record) return;
  openModal('Edit Purchase', purchaseFormHtml(record));
  bindPurchaseFormEvents(id);
}

function deletePurchase(id) {
  confirmAction('Delete this purchase entry? This cannot be undone.', () => {
    DB.remove('purchase', id);
    toast('Purchase entry deleted.');
    renderPurchaseTable();
    refreshDashboard();
  });
}

function getFilteredPurchases() {
  let list = DB.getAll('purchase').slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (PurchaseState.search) {
    const s = PurchaseState.search.toLowerCase();
    list = list.filter(r =>
      String(r.date).toLowerCase().includes(s) ||
      String(r.total_amount).toLowerCase().includes(s) ||
      String(r.slnk_amount).toLowerCase().includes(s)
    );
  }
  if (PurchaseState.filterDate) list = list.filter(r => r.date === PurchaseState.filterDate);
  if (PurchaseState.filterMonth) list = list.filter(r => (r.date || '').slice(0, 7) === PurchaseState.filterMonth);
  return list;
}

function renderPurchaseSummary() {
  const all = DB.getAll('purchase');
  const tssQty = all.reduce((s, r) => s + (Number(r.tss_quantity) || 0), 0);
  const tssAmt = all.reduce((s, r) => s + (Number(r.tss_amount)   || 0), 0);
  const tmsQty = all.reduce((s, r) => s + (Number(r.tms_quantity) || 0), 0);
  const tmsAmt = all.reduce((s, r) => s + (Number(r.tms_amount)   || 0), 0);

  const manual = getManualSold();
  const tssRemaining = roundNum(tssQty - manual.tss);
  const tmsRemaining = roundNum(tmsQty - manual.tms);

  const totalAmt = roundNum(tssAmt + tmsAmt);
  const totalQty = roundNum(tssQty + tmsQty);
  const slnkAmt  = roundNum(totalAmt + (totalQty * 4));

  document.getElementById('sumTssQty').textContent       = formatQty(tssQty) + ' kg';
  document.getElementById('sumTmsQty').textContent       = formatQty(tmsQty) + ' kg';
  document.getElementById('sumTssRemaining').textContent = formatQty(tssRemaining) + ' kg';
  document.getElementById('sumTmsRemaining').textContent = formatQty(tmsRemaining) + ' kg';
  document.getElementById('sumTotalAmt').textContent     = formatCurrency(totalAmt);
  document.getElementById('sumSlnkAmt').textContent      = formatCurrency(slnkAmt);

  // Manual sold inputs (overall total entered by user)
  const tssSoldInput = document.getElementById('sumTssSoldInput');
  const tmsSoldInput = document.getElementById('sumTmsSoldInput');
  if (tssSoldInput && document.activeElement !== tssSoldInput) tssSoldInput.value = manual.tss;
  if (tmsSoldInput && document.activeElement !== tmsSoldInput) tmsSoldInput.value = manual.tms;
}

// Bind manual-sold input handlers once on first render
function bindManualSoldInputs() {
  const tssIn = document.getElementById('sumTssSoldInput');
  const tmsIn = document.getElementById('sumTmsSoldInput');
  if (tssIn && !tssIn.dataset.bound) {
    tssIn.dataset.bound = '1';
    tssIn.addEventListener('input', () => {
      setManualSold({ tss: Number(tssIn.value) || 0 });
      renderPurchaseSummary();
      refreshDashboard();
    });
  }
  if (tmsIn && !tmsIn.dataset.bound) {
    tmsIn.dataset.bound = '1';
    tmsIn.addEventListener('input', () => {
      setManualSold({ tms: Number(tmsIn.value) || 0 });
      renderPurchaseSummary();
      refreshDashboard();
    });
  }
}

function renderPurchaseTable() {
  bindManualSoldInputs();
  renderPurchaseSummary();
  const all = getFilteredPurchases();
  const pageItems = paginate(all, PurchaseState.page, PurchaseState.pageSize);
  const tbody = document.getElementById('purchaseTableBody');

  if (!pageItems.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No purchase records found.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(r => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td>${formatQty(r.tss_quantity)}</td>
        <td>${formatCurrency(r.tss_amount)}</td>
        <td>${formatQty(r.tms_quantity)}</td>
        <td>${formatCurrency(r.tms_amount)}</td>
        <td>${formatCurrency(r.total_amount)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick="editPurchase(${r.id})">✎ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deletePurchase(${r.id})">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderPagination('purchasePagination', all.length, PurchaseState.pageSize, PurchaseState.page, (p) => {
    PurchaseState.page = p;
    renderPurchaseTable();
  });
}

document.getElementById('purchaseSearch').addEventListener('input', (e) => {
  PurchaseState.search = e.target.value;
  PurchaseState.page = 1;
  renderPurchaseTable();
});
document.getElementById('purchaseFilterDate').addEventListener('change', (e) => {
  PurchaseState.filterDate = e.target.value;
  PurchaseState.page = 1;
  renderPurchaseTable();
});
document.getElementById('purchaseFilterMonth').addEventListener('change', (e) => {
  PurchaseState.filterMonth = e.target.value;
  PurchaseState.page = 1;
  renderPurchaseTable();
});
document.getElementById('purchaseClearFilters').addEventListener('click', () => {
  PurchaseState.search = '';
  PurchaseState.filterDate = '';
  PurchaseState.filterMonth = '';
  document.getElementById('purchaseSearch').value = '';
  document.getElementById('purchaseFilterDate').value = '';
  document.getElementById('purchaseFilterMonth').value = '';
  PurchaseState.page = 1;
  renderPurchaseTable();
});
