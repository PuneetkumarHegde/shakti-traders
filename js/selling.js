/* ============================================================
   selling.js — Selling module (split TSS / TMS quantities)
============================================================ */

const SellingState = {
  page: 1,
  pageSize: 8,
  search: '',
  filterDate: '',
  filterMonth: ''
};

function getTotalPurchasedTssQty() {
  return DB.getAll('purchase').reduce((sum, r) => sum + (Number(r.tss_quantity) || 0), 0);
}
function getTotalPurchasedTmsQty() {
  return DB.getAll('purchase').reduce((sum, r) => sum + (Number(r.tms_quantity) || 0), 0);
}
function getTotalPurchasedQty() {
  return getTotalPurchasedTssQty() + getTotalPurchasedTmsQty();
}

function getTotalSoldTssQty(excludeId = null) {
  return DB.getAll('selling')
    .filter(r => r.id !== excludeId)
    .reduce((sum, r) => sum + (Number(r.tss_selling_quantity) || 0), 0);
}
function getTotalSoldTmsQty(excludeId = null) {
  return DB.getAll('selling')
    .filter(r => r.id !== excludeId)
    .reduce((sum, r) => sum + (Number(r.tms_selling_quantity) || 0), 0);
}
function getTotalSoldQty(excludeId = null) {
  return DB.getAll('selling')
    .filter(r => r.id !== excludeId)
    .reduce((sum, r) => {
      const hasSplit = (r.tss_selling_quantity !== undefined || r.tms_selling_quantity !== undefined);
      const qty = hasSplit
        ? (Number(r.tss_selling_quantity) || 0) + (Number(r.tms_selling_quantity) || 0)
        : (Number(r.selling_quantity) || 0);
      return sum + qty;
    }, 0);
}

function getAvailableTssQty(excludeId = null) {
  return getTotalPurchasedTssQty() - getTotalSoldTssQty(excludeId);
}
function getAvailableTmsQty(excludeId = null) {
  return getTotalPurchasedTmsQty() - getTotalSoldTmsQty(excludeId);
}
function getAvailableQuantity(excludeId = null) {
  return getTotalPurchasedQty() - getTotalSoldQty(excludeId);
}

function sellingFormHtml(record) {
  const r = record || {};
  const availTss = getAvailableTssQty(record ? record.id : null);
  const availTms = getAvailableTmsQty(record ? record.id : null);
  return `
    <form id="sellingForm">
      <label>Date
        <input type="date" id="s_date" value="${r.date || ''}" required>
      </label>

      <div class="calc-row" id="s_available_tss">Available TSS Quantity: ${formatQty(availTss)}</div>
      <label>TSS Selling Quantity
        <input type="number" step="any" id="s_tss_qty" value="${r.tss_selling_quantity ?? ''}" required>
      </label>

      <div class="calc-row" id="s_available_tms">Available TMS Quantity: ${formatQty(availTms)}</div>
      <label>TMS Selling Quantity
        <input type="number" step="any" id="s_tms_qty" value="${r.tms_selling_quantity ?? ''}" required>
      </label>

      <label>Amount
        <input type="number" step="any" id="s_amount" value="${r.amount ?? ''}" required>
      </label>
      <label>Description
        <textarea id="s_desc" rows="2">${escapeHtml(r.description || '')}</textarea>
      </label>

      <div class="calc-row" id="s_remaining">
        Remaining TSS: ${formatQty(availTss)} &nbsp;|&nbsp; Remaining TMS: ${formatQty(availTms)}
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="sellingCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${record ? 'Update' : 'Save'} Sale</button>
      </div>
    </form>
  `;
}

function bindSellingFormEvents(editId) {
  const availTss = getAvailableTssQty(editId);
  const availTms = getAvailableTmsQty(editId);
  const tssInput = document.getElementById('s_tss_qty');
  const tmsInput = document.getElementById('s_tms_qty');

  function updateRemaining() {
    const tssQty = Number(tssInput.value) || 0;
    const tmsQty = Number(tmsInput.value) || 0;
    const remTss = availTss - tssQty;
    const remTms = availTms - tmsQty;
    const el = document.getElementById('s_remaining');
    el.innerHTML = `Remaining TSS: ${formatQty(remTss)} &nbsp;|&nbsp; Remaining TMS: ${formatQty(remTms)}`;
    el.style.color = (remTss < 0 || remTms < 0) ? '#c0392b' : '';
  }
  tssInput.addEventListener('input', updateRemaining);
  tmsInput.addEventListener('input', updateRemaining);
  updateRemaining();

  document.getElementById('sellingCancel').addEventListener('click', closeModal);

  document.getElementById('sellingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const tssQty = Number(tssInput.value) || 0;
    const tmsQty = Number(tmsInput.value) || 0;

    if (tssQty > availTss || tmsQty > availTms) {
      const ok = confirm(
        `Selling quantity exceeds available stock (TSS available: ${formatQty(availTss)}, TMS available: ${formatQty(availTms)}). Continue anyway?`
      );
      if (!ok) return;
    }

    const record = {
      date: document.getElementById('s_date').value,
      available_tss_quantity: availTss,
      tss_selling_quantity: tssQty,
      available_tms_quantity: availTms,
      tms_selling_quantity: tmsQty,
      available_quantity: roundNum(availTss + availTms),
      selling_quantity: roundNum(tssQty + tmsQty),
      amount: ceilMoney(document.getElementById('s_amount').value),
      description: document.getElementById('s_desc').value.trim(),
      remaining_tss_quantity: roundNum(availTss - tssQty),
      remaining_tms_quantity: roundNum(availTms - tmsQty),
      remaining_quantity: roundNum((availTss - tssQty) + (availTms - tmsQty))
    };

    showLoading(true);
    setTimeout(() => {
      if (editId) {
        DB.update('selling', editId, record);
        toast('Sale entry updated successfully.');
      } else {
        DB.insert('selling', record);
        toast('Sale entry added successfully.');
      }
      showLoading(false);
      closeModal();
      SellingState.page = 1;
      renderSellingTable();
      refreshDashboard();
    }, 250);
  });
}

document.getElementById('addSellingBtn').addEventListener('click', () => {
  openModal('Add Sale', sellingFormHtml(null));
  bindSellingFormEvents(null);
});

function editSelling(id) {
  const record = DB.getById('selling', id);
  if (!record) return;
  openModal('Edit Sale', sellingFormHtml(record));
  bindSellingFormEvents(id);
}

function deleteSelling(id) {
  confirmAction('Delete this sale entry? This cannot be undone.', () => {
    DB.remove('selling', id);
    toast('Sale entry deleted.');
    renderSellingTable();
    refreshDashboard();
  });
}

function getFilteredSellings() {
  let list = DB.getAll('selling').slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (SellingState.search) {
    const s = SellingState.search.toLowerCase();
    list = list.filter(r =>
      String(r.date).toLowerCase().includes(s) ||
      String(r.description || '').toLowerCase().includes(s)
    );
  }
  if (SellingState.filterDate) {
    list = list.filter(r => r.date === SellingState.filterDate);
  }
  if (SellingState.filterMonth) {
    list = list.filter(r => (r.date || '').slice(0, 7) === SellingState.filterMonth);
  }
  return list;
}

function fmtMaybe(v) { return typeof v === 'number' ? formatQty(v) : '-'; }

function renderSellingTable() {
  const all = getFilteredSellings();
  const pageItems = paginate(all, SellingState.page, SellingState.pageSize);
  const tbody = document.getElementById('sellingTableBody');

  if (!pageItems.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No selling records found.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(r => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td>${fmtMaybe(r.available_tss_quantity)}</td>
        <td>${fmtMaybe(r.tss_selling_quantity)}</td>
        <td>${fmtMaybe(r.available_tms_quantity)}</td>
        <td>${fmtMaybe(r.tms_selling_quantity)}</td>
        <td>${formatCurrency(r.amount)}</td>
        <td>${escapeHtml(r.description || '-')}</td>
        <td>${fmtMaybe(r.remaining_tss_quantity)} / ${fmtMaybe(r.remaining_tms_quantity)}</td>
        <td>
          <div class="row-actions">
            <button onclick="editSelling(${r.id})">Edit</button>
            <button class="del" onclick="deleteSelling(${r.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderPagination('sellingPagination', all.length, SellingState.pageSize, SellingState.page, (p) => {
    SellingState.page = p;
    renderSellingTable();
  });
}

document.getElementById('sellingSearch').addEventListener('input', (e) => {
  SellingState.search = e.target.value;
  SellingState.page = 1;
  renderSellingTable();
});
document.getElementById('sellingFilterDate').addEventListener('change', (e) => {
  SellingState.filterDate = e.target.value;
  SellingState.page = 1;
  renderSellingTable();
});
document.getElementById('sellingFilterMonth').addEventListener('change', (e) => {
  SellingState.filterMonth = e.target.value;
  SellingState.page = 1;
  renderSellingTable();
});
document.getElementById('sellingClearFilters').addEventListener('click', () => {
  SellingState.search = '';
  SellingState.filterDate = '';
  SellingState.filterMonth = '';
  document.getElementById('sellingSearch').value = '';
  document.getElementById('sellingFilterDate').value = '';
  document.getElementById('sellingFilterMonth').value = '';
  SellingState.page = 1;
  renderSellingTable();
});
