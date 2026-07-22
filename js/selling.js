/* ============================================================
   selling.js — Selling module (split TSS / TMS quantities)
   MIGRATED: All DB calls are now async/await (Supabase).
============================================================ */

const SellingState = {
  page: 1,
  pageSize: 8,
  search: '',
  filterDate: '',
  filterMonth: ''
};

/* ---------- Stock helpers (all now async) ---------- */
async function getTotalPurchasedTssQty() {
  const rows = await DB.getAll('purchase');
  return rows.reduce((sum, r) => sum + (Number(r.tss_quantity) || 0), 0);
}
async function getTotalPurchasedTmsQty() {
  const rows = await DB.getAll('purchase');
  return rows.reduce((sum, r) => sum + (Number(r.tms_quantity) || 0), 0);
}
async function getTotalPurchasedQty() {
  return (await getTotalPurchasedTssQty()) + (await getTotalPurchasedTmsQty());
}

async function getTotalSoldTssQty(excludeId = null) {
  const rows = await DB.getAll('selling');
  return rows
    .filter(r => r.id !== excludeId)
    .reduce((sum, r) => sum + (Number(r.tss_selling_quantity) || 0), 0);
}
async function getTotalSoldTmsQty(excludeId = null) {
  const rows = await DB.getAll('selling');
  return rows
    .filter(r => r.id !== excludeId)
    .reduce((sum, r) => sum + (Number(r.tms_selling_quantity) || 0), 0);
}
async function getTotalSoldQty(excludeId = null) {
  const rows = await DB.getAll('selling');
  return rows
    .filter(r => r.id !== excludeId)
    .reduce((sum, r) => {
      const hasSplit = (r.tss_selling_quantity !== undefined || r.tms_selling_quantity !== undefined);
      const qty = hasSplit
        ? (Number(r.tss_selling_quantity) || 0) + (Number(r.tms_selling_quantity) || 0)
        : (Number(r.selling_quantity) || 0);
      return sum + qty;
    }, 0);
}

async function getAvailableTssQty(excludeId = null) {
  return (await getTotalPurchasedTssQty()) - (await getTotalSoldTssQty(excludeId));
}
async function getAvailableTmsQty(excludeId = null) {
  return (await getTotalPurchasedTmsQty()) - (await getTotalSoldTmsQty(excludeId));
}
async function getAvailableQuantity(excludeId = null) {
  return (await getTotalPurchasedQty()) - (await getTotalSoldQty(excludeId));
}

/* ---------- Form HTML (unchanged) ---------- */
async function sellingFormHtml(record) {
  const r        = record || {};
  const availTss = await getAvailableTssQty(record ? record.id : null);
  const availTms = await getAvailableTmsQty(record ? record.id : null);
  return `
    <form id="sellingForm">
      <div style="display:flex;gap:10px;">
        <label style="flex:1;">Date
          <input type="date" id="s_date" value="${r.date || ''}" required>
        </label>
        <label style="flex:1;">Bill Number
          <input type="text" id="s_bill_no" value="${escapeHtml(r.bill_number || '')}" placeholder="e.g. INV-1024">
        </label>
      </div>
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

function bindSellingFormEvents(editId, availTss, availTms) {
  const tssInput = document.getElementById('s_tss_qty');
  const tmsInput = document.getElementById('s_tms_qty');

  function updateRemaining() {
    const remTss = availTss - (Number(tssInput.value) || 0);
    const remTms = availTms - (Number(tmsInput.value) || 0);
    const el = document.getElementById('s_remaining');
    el.innerHTML = `Remaining TSS: ${formatQty(remTss)} &nbsp;|&nbsp; Remaining TMS: ${formatQty(remTms)}`;
    el.style.color = (remTss < 0 || remTms < 0) ? '#c0392b' : '';
  }
  tssInput.addEventListener('input', updateRemaining);
  tmsInput.addEventListener('input', updateRemaining);
  updateRemaining();

  document.getElementById('sellingCancel').addEventListener('click', closeModal);

  document.getElementById('sellingForm').addEventListener('submit', async (e) => {
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
      date:                    document.getElementById('s_date').value,
      bill_number:             document.getElementById('s_bill_no').value.trim(),
      available_tss_quantity:  availTss,
      tss_selling_quantity:    tssQty,
      available_tms_quantity:  availTms,
      tms_selling_quantity:    tmsQty,
      available_quantity:      roundNum(availTss + availTms),
      selling_quantity:        roundNum(tssQty + tmsQty),
      amount:                  ceilMoney(document.getElementById('s_amount').value),
      description:             document.getElementById('s_desc').value.trim(),
      remaining_tss_quantity:  roundNum(availTss - tssQty),
      remaining_tms_quantity:  roundNum(availTms - tmsQty),
      remaining_quantity:      roundNum((availTss - tssQty) + (availTms - tmsQty))
    };

    showLoading(true);
    try {
      if (editId) {
        await DB.update('selling', editId, record);
        toast('Sale entry updated successfully.');
      } else {
        await DB.insert('selling', record);
        toast('Sale entry added successfully.');
      }
      closeModal();
      SellingState.page = 1;
      await renderSellingTable();
      await refreshDashboard();
    } catch (err) {
      console.error(err);
      toast('Failed to save sale. Please try again.', 'error');
    } finally {
      showLoading(false);
    }
  });
}

document.getElementById('addSellingBtn').addEventListener('click', async () => {
  showLoading(true);
  try {
    const html = await sellingFormHtml(null);
    const availTss = await getAvailableTssQty(null);
    const availTms = await getAvailableTmsQty(null);
    openModal('Add Sale', html);
    bindSellingFormEvents(null, availTss, availTms);
  } finally {
    showLoading(false);
  }
});

async function editSelling(id) {
  showLoading(true);
  try {
    const record = await DB.getById('selling', id);
    if (!record) return;
    const availTss = await getAvailableTssQty(id);
    const availTms = await getAvailableTmsQty(id);
    const html     = await sellingFormHtml(record);
    openModal('Edit Sale', html);
    bindSellingFormEvents(id, availTss, availTms);
  } finally {
    showLoading(false);
  }
}

async function deleteSelling(id) {
  confirmAction('Delete this sale entry? This cannot be undone.', async () => {
    showLoading(true);
    try {
      await DB.remove('selling', id);
      toast('Sale entry deleted.');
      await renderSellingTable();
      await refreshDashboard();
    } catch (err) {
      console.error(err);
      toast('Failed to delete entry.', 'error');
    } finally {
      showLoading(false);
    }
  });
}

async function getFilteredSellings() {
  let list = (await DB.getAll('selling')).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (SellingState.search) {
    const s = SellingState.search.toLowerCase();
    list = list.filter(r =>
      String(r.date).toLowerCase().includes(s) ||
      String(r.bill_number || '').toLowerCase().includes(s) ||
      String(r.description || '').toLowerCase().includes(s)
    );
  }
  if (SellingState.filterDate)  list = list.filter(r => r.date === SellingState.filterDate);
  if (SellingState.filterMonth) list = list.filter(r => (r.date || '').slice(0, 7) === SellingState.filterMonth);
  return list;
}

function fmtMaybe(v) { return typeof v === 'number' ? formatQty(v) : '-'; }

async function renderSellingTable() {
  const all       = await getFilteredSellings();
  const pageItems = paginate(all, SellingState.page, SellingState.pageSize);
  const tbody     = document.getElementById('sellingTableBody');

  if (!pageItems.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">No selling records found.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(r => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td>${escapeHtml(r.bill_number || '-')}</td>
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

  renderPagination('sellingPagination', all.length, SellingState.pageSize, SellingState.page, async (p) => {
    SellingState.page = p;
    await renderSellingTable();
  });
}

/* ---------- Filter controls ---------- */
document.getElementById('sellingSearch').addEventListener('input', async (e) => {
  SellingState.search = e.target.value;
  SellingState.page   = 1;
  await renderSellingTable();
});
document.getElementById('sellingFilterDate').addEventListener('change', async (e) => {
  SellingState.filterDate = e.target.value;
  SellingState.page       = 1;
  await renderSellingTable();
});
document.getElementById('sellingFilterMonth').addEventListener('change', async (e) => {
  SellingState.filterMonth = e.target.value;
  SellingState.page        = 1;
  await renderSellingTable();
});
document.getElementById('sellingClearFilters').addEventListener('click', async () => {
  SellingState.search      = '';
  SellingState.filterDate  = '';
  SellingState.filterMonth = '';
  document.getElementById('sellingSearch').value      = '';
  document.getElementById('sellingFilterDate').value  = '';
  document.getElementById('sellingFilterMonth').value = '';
  SellingState.page = 1;
  await renderSellingTable();
});
