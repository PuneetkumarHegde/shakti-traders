/* ============================================================
   purchase.js  v5
   New features:
   • Smart SLNK: auto-calculated on new purchase, editable
   • Sold history with Undo / Redo (persisted in Supabase meta)
   • Collapsible history panel with Edit / Delete per entry
============================================================ */

const PurchaseState = {
  page: 1, pageSize: 8,
  search: '', filterDate: '', filterMonth: ''
};

/* ── tiny UUID ─────────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ════════════════════════════════════════════════════════
   SOLD HISTORY  (stored in Supabase meta)
   Entry shape: { id, ts, qty }
   Keys: tss_history / tms_history / tss_redo / tms_redo
════════════════════════════════════════════════════════ */

async function getHistory(type) {
  try {
    const raw = await DB.getMeta(`${type}_history`);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}
async function saveHistory(type, arr) { await DB.setMeta(`${type}_history`, arr); }

async function getRedoStack(type) {
  try {
    const raw = await DB.getMeta(`${type}_redo`);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}
async function saveRedoStack(type, arr) { await DB.setMeta(`${type}_redo`, arr); }

/* Sync the cached manual_sold so dashboard.js / getManualSold() still works */
async function syncManualSold() {
  const [th, mh] = await Promise.all([getHistory('tss'), getHistory('tms')]);
  const tss = roundNum(th.reduce((s, e) => s + (Number(e.qty) || 0), 0));
  const tms = roundNum(mh.reduce((s, e) => s + (Number(e.qty) || 0), 0));
  await DB.setMeta('manual_sold', { tss, tms });
}

/* getManualSold — still used by dashboard.js (reads cached value) */
async function getManualSold() {
  try {
    const raw = await DB.getMeta('manual_sold');
    const v   = raw ? JSON.parse(raw) : {};
    return { tss: Number(v.tss) || 0, tms: Number(v.tms) || 0 };
  } catch (_) { return { tss: 0, tms: 0 }; }
}

/* ── Operations ────────────────────────────────────────── */
async function addSold(type, qty) {
  const entry   = { id: uid(), ts: new Date().toISOString(), qty: roundNum(qty) };
  const history = await getHistory(type);
  history.push(entry);
  await Promise.all([saveHistory(type, history), saveRedoStack(type, [])]);
  await syncManualSold();
}

async function undoSold(type) {
  const history = await getHistory(type);
  if (!history.length) return false;
  const entry = history.pop();
  const redo  = await getRedoStack(type);
  redo.push(entry);
  await Promise.all([saveHistory(type, history), saveRedoStack(type, redo)]);
  await syncManualSold();
  return true;
}

async function redoSold(type) {
  const redo = await getRedoStack(type);
  if (!redo.length) return false;
  const entry   = redo.pop();
  const history = await getHistory(type);
  history.push(entry);
  await Promise.all([saveHistory(type, history), saveRedoStack(type, redo)]);
  await syncManualSold();
  return true;
}

async function clearSold(type) {
  await Promise.all([saveHistory(type, []), saveRedoStack(type, [])]);
  await syncManualSold();
}

async function editSoldEntry(type, entryId, newQty) {
  const history = await getHistory(type);
  const idx     = history.findIndex(e => e.id === entryId);
  if (idx < 0) return;
  history[idx].qty = roundNum(newQty);
  await saveHistory(type, history);
  await syncManualSold();
}

async function deleteSoldEntry(type, entryId) {
  let history = await getHistory(type);
  history     = history.filter(e => e.id !== entryId);
  await saveHistory(type, history);
  await syncManualSold();
}

/* ── Format ISO timestamp for history display ────────── */
function fmtHistoryTs(tsIso) {
  const d    = new Date(tsIso);
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

/* ── Render history panel ─────────────────────────────── */
async function renderHistoryPanel(type) {
  const listEl = document.getElementById(`${type}HistoryList`);
  if (!listEl) return;
  const history = await getHistory(type);
  if (!history.length) {
    listEl.innerHTML = '<p class="history-empty">No sold entries yet.</p>';
    return;
  }
  listEl.innerHTML = history.map(e => {
    const { date, time } = fmtHistoryTs(e.ts);
    return `
      <div class="history-row">
        <span class="h-date">${date}</span>
        <span class="h-time">${time}</span>
        <span class="h-qty">+${formatQty(e.qty)} kg</span>
        <div class="h-actions">
          <button class="btn btn-ghost btn-xs"
            onclick="startEditHistoryEntry('${type}','${e.id}',${e.qty})">✎</button>
          <button class="btn btn-danger btn-xs"
            onclick="deleteHistoryEntry('${type}','${e.id}')">✕</button>
        </div>
      </div>`;
  }).join('');
}

/* Exposed globally for inline onclick */
window.startEditHistoryEntry = function (type, entryId, cur) {
  const newQtyStr = prompt(`Edit quantity (current: ${cur} kg):`, cur);
  if (newQtyStr === null) return;
  const newQty = parseFloat(newQtyStr);
  if (isNaN(newQty) || newQty <= 0) return toast('Invalid quantity.', 'error');
  showLoading(true);
  editSoldEntry(type, entryId, newQty)
    .then(async () => {
      await renderPurchaseSummary();
      await renderHistoryPanel(type);
      await refreshDashboard();
      toast('Entry updated.');
    })
    .catch(err => { console.error(err); toast('Failed to update.', 'error'); })
    .finally(() => showLoading(false));
};

window.deleteHistoryEntry = function (type, entryId) {
  confirmAction('Delete this sold entry?', async () => {
    showLoading(true);
    try {
      await deleteSoldEntry(type, entryId);
      await renderPurchaseSummary();
      await renderHistoryPanel(type);
      await refreshDashboard();
      toast('Entry deleted.');
    } catch (err) { console.error(err); toast('Failed to delete.', 'error'); }
    finally { showLoading(false); }
  });
};

/* ════════════════════════════════════════════════════════
   PURCHASE FORM  (Smart SLNK)
════════════════════════════════════════════════════════ */
function purchaseFormHtml(record) {
  const r = record || {};
  return `
    <form id="purchaseForm">
      <label>Date
        <input type="date" id="p_date" value="${r.date || ''}" required>
      </label>
      <label>TSS Purchased Quantity (kg)
        <input type="number" step="any" id="p_tssq" value="${r.tss_quantity ?? ''}" required>
      </label>
      <label>TSS Amount (₹)
        <input type="number" step="any" id="p_tssa" value="${r.tss_amount ?? ''}" required>
      </label>
      <label>TMS Purchased Quantity (kg)
        <input type="number" step="any" id="p_tmsq" value="${r.tms_quantity ?? ''}" required>
      </label>
      <label>TMS Amount (₹)
        <input type="number" step="any" id="p_tmsa" value="${r.tms_amount ?? ''}" required>
      </label>
      <label>SLNK Amount (₹)
        <small style="color:var(--muted);font-size:11px;"> auto-calculated, you can edit</small>
        <input type="number" step="any" id="p_slnk" value="${r.slnk_amount ?? ''}" required>
      </label>
      <div class="calc-row" id="p_calc"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="purchaseCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${record ? 'Update' : 'Save'} Purchase</button>
      </div>
    </form>`;
}

function bindPurchaseFormEvents(editId) {
  const slnkInput = document.getElementById('p_slnk');
  // On edit: don't auto-overwrite stored SLNK. On new: auto-calculate.
  let slnkManual = !!editId;

  slnkInput.addEventListener('input', () => { slnkManual = true; });

  function updateCalc() {
    const tssQ  = Number(document.getElementById('p_tssq').value) || 0;
    const tmsQ  = Number(document.getElementById('p_tmsq').value) || 0;
    const tssA  = Number(document.getElementById('p_tssa').value) || 0;
    const tmsA  = Number(document.getElementById('p_tmsa').value) || 0;
    const totalQ = tssQ + tmsQ;
    const totalA = tssA + tmsA;

    if (!slnkManual) {
      // Auto-fill SLNK: total_amount + (total_quantity × 4)
      slnkInput.value = Math.ceil(totalA + (totalQ * 4));
    }
    document.getElementById('p_calc').innerHTML =
      `Total Qty: ${formatQty(totalQ)} kg &nbsp;|&nbsp; Total Amount: ${formatCurrency(totalA)}`;
  }

  ['p_tssq', 'p_tssa', 'p_tmsq', 'p_tmsa'].forEach(id =>
    document.getElementById(id).addEventListener('input', updateCalc));
  updateCalc();

  document.getElementById('purchaseCancel').addEventListener('click', closeModal);

  document.getElementById('purchaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tssQ = Number(document.getElementById('p_tssq').value) || 0;
    const tmsQ = Number(document.getElementById('p_tmsq').value) || 0;
    const tssA = Number(document.getElementById('p_tssa').value) || 0;
    const tmsA = Number(document.getElementById('p_tmsa').value) || 0;

    const record = {
      date:           document.getElementById('p_date').value,
      tss_quantity:   tssQ,
      tss_amount:     tssA,
      tms_quantity:   tmsQ,
      tms_amount:     tmsA,
      total_quantity: roundNum(tssQ + tmsQ),
      total_amount:   tssA + tmsA,
      slnk_quantity:  roundNum(tssQ + tmsQ),
      slnk_amount:    Number(slnkInput.value) || 0,
      ...(editId ? {} : {
        tss_sold_quantity: 0, tms_sold_quantity: 0,
        tss_remaining_quantity: tssQ, tms_remaining_quantity: tmsQ,
        total_sold_quantity: 0,
        total_remaining_quantity: roundNum(tssQ + tmsQ)
      })
    };

    showLoading(true);
    try {
      if (editId) {
        await DB.update('purchase', editId, record);
        toast('Purchase entry updated successfully.');
      } else {
        await DB.insert('purchase', record);
        toast('Purchase entry added successfully.');
      }
      closeModal();
      PurchaseState.page = 1;
      await renderPurchaseTable();
      await refreshDashboard();
    } catch (err) {
      console.error(err);
      toast('Failed to save purchase. Please try again.', 'error');
    } finally { showLoading(false); }
  });
}

document.getElementById('addPurchaseBtn').addEventListener('click', () => {
  openModal('Add Purchase', purchaseFormHtml(null));
  bindPurchaseFormEvents(null);
});

async function editPurchase(id) {
  showLoading(true);
  try {
    const record = await DB.getById('purchase', id);
    if (!record) return;
    openModal('Edit Purchase', purchaseFormHtml(record));
    bindPurchaseFormEvents(id);
  } finally { showLoading(false); }
}

async function deletePurchase(id) {
  confirmAction('Delete this purchase entry? This cannot be undone.', async () => {
    showLoading(true);
    try {
      await DB.remove('purchase', id);
      toast('Purchase entry deleted.');
      await renderPurchaseTable();
      await refreshDashboard();
    } catch (err) { console.error(err); toast('Failed to delete entry.', 'error'); }
    finally { showLoading(false); }
  });
}

/* ════════════════════════════════════════════════════════
   SUMMARY CARD
════════════════════════════════════════════════════════ */
async function renderPurchaseSummary() {
  const [all, tssHist, tmsHist, tssRedo, tmsRedo] = await Promise.all([
    DB.getAll('purchase'),
    getHistory('tss'), getHistory('tms'),
    getRedoStack('tss'), getRedoStack('tms')
  ]);

  const tssQty  = all.reduce((s, r) => s + (Number(r.tss_quantity)  || 0), 0);
  const tmsQty  = all.reduce((s, r) => s + (Number(r.tms_quantity)  || 0), 0);
  const totalAmt  = all.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
  const totalSlnk = all.reduce((s, r) => s + (Number(r.slnk_amount) || 0), 0);

  const tssSold = roundNum(tssHist.reduce((s, e) => s + (Number(e.qty) || 0), 0));
  const tmsSold = roundNum(tmsHist.reduce((s, e) => s + (Number(e.qty) || 0), 0));

  document.getElementById('sumTssQty').textContent       = formatQty(tssQty)           + ' kg';
  document.getElementById('sumTssSold').textContent      = formatQty(tssSold)           + ' kg';
  document.getElementById('sumTssRemaining').textContent = formatQty(roundNum(tssQty - tssSold)) + ' kg';
  document.getElementById('sumTmsQty').textContent       = formatQty(tmsQty)           + ' kg';
  document.getElementById('sumTmsSold').textContent      = formatQty(tmsSold)           + ' kg';
  document.getElementById('sumTmsRemaining').textContent = formatQty(roundNum(tmsQty - tmsSold)) + ' kg';
  document.getElementById('sumTotalAmt').textContent     = formatCurrency(totalAmt);
  document.getElementById('sumSlnkAmt').textContent      = formatCurrency(totalSlnk);

  // Undo/redo button states
  const states = {
    tssUndo: tssHist.length > 0,  tssRedo: tssRedo.length > 0,
    tmsUndo: tmsHist.length > 0,  tmsRedo: tmsRedo.length > 0
  };
  Object.entries(states).forEach(([id, enabled]) => {
    const btn = document.getElementById(id + 'Btn');
    if (btn) btn.disabled = !enabled;
  });
}

/* ════════════════════════════════════════════════════════
   BIND SOLD BUTTONS (called once per renderPurchaseTable)
════════════════════════════════════════════════════════ */
function bindSoldAddButtons() {
  ['tss', 'tms'].forEach(type => {
    const input    = document.getElementById(`${type}TodaySoldInput`);
    const addBtn   = document.getElementById(`${type}TodaySoldAddBtn`);
    const undoBtn  = document.getElementById(`${type}UndoBtn`);
    const redoBtn  = document.getElementById(`${type}RedoBtn`);
    const clearBtn = document.getElementById(`${type}ClearSoldBtn`);
    const toggle   = document.getElementById(`${type}HistoryToggle`);
    const panel    = document.getElementById(`${type}HistoryPanel`);

    function isPanelOpen() { return panel && !panel.classList.contains('hidden'); }

    async function afterOp() {
      await renderPurchaseSummary();
      if (isPanelOpen()) await renderHistoryPanel(type);
      await refreshDashboard();
    }

    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', async () => {
        const qty = Number(input.value);
        if (!qty || qty <= 0) return toast(`Enter a valid ${type.toUpperCase()} quantity.`, 'error');
        showLoading(true);
        try {
          await addSold(type, qty);
          input.value = '';
          await afterOp();
          toast(`${type.toUpperCase()} sold quantity added.`);
        } catch (err) { console.error(err); toast('Failed to add sold qty.', 'error'); }
        finally { showLoading(false); }
      });
    }

    if (undoBtn && !undoBtn.dataset.bound) {
      undoBtn.dataset.bound = '1';
      undoBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
          const ok = await undoSold(type);
          if (!ok) return toast('Nothing to undo.', 'error');
          await afterOp();
          toast(`${type.toUpperCase()} undo successful.`);
        } catch (err) { console.error(err); toast('Undo failed.', 'error'); }
        finally { showLoading(false); }
      });
    }

    if (redoBtn && !redoBtn.dataset.bound) {
      redoBtn.dataset.bound = '1';
      redoBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
          const ok = await redoSold(type);
          if (!ok) return toast('Nothing to redo.', 'error');
          await afterOp();
          toast(`${type.toUpperCase()} redo successful.`);
        } catch (err) { console.error(err); toast('Redo failed.', 'error'); }
        finally { showLoading(false); }
      });
    }

    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = '1';
      clearBtn.addEventListener('click', () => {
        confirmAction(`Reset ALL ${type.toUpperCase()} sold quantities to zero?`, async () => {
          showLoading(true);
          try {
            await clearSold(type);
            await afterOp();
            toast(`${type.toUpperCase()} sold quantity cleared.`);
          } catch (err) { console.error(err); toast('Clear failed.', 'error'); }
          finally { showLoading(false); }
        });
      });
    }

    if (toggle && !toggle.dataset.bound) {
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', async () => {
        const opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        toggle.textContent = opening ? '▲ Hide Sold History' : '▼ View Sold History';
        if (opening) await renderHistoryPanel(type);
      });
    }
  });
}

/* ════════════════════════════════════════════════════════
   TABLE RENDER
════════════════════════════════════════════════════════ */
async function getFilteredPurchases() {
  let list = (await DB.getAll('purchase')).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (PurchaseState.search) {
    const s = PurchaseState.search.toLowerCase();
    list = list.filter(r =>
      String(r.date).includes(s) || String(r.total_amount).includes(s) || String(r.slnk_amount).includes(s));
  }
  if (PurchaseState.filterDate)  list = list.filter(r => r.date === PurchaseState.filterDate);
  if (PurchaseState.filterMonth) list = list.filter(r => (r.date || '').slice(0, 7) === PurchaseState.filterMonth);
  return list;
}

async function renderPurchaseTable() {
  bindSoldAddButtons();
  await renderPurchaseSummary();

  // Re-render open history panels
  for (const type of ['tss', 'tms']) {
    const panel = document.getElementById(`${type}HistoryPanel`);
    if (panel && !panel.classList.contains('hidden')) await renderHistoryPanel(type);
  }

  const all       = await getFilteredPurchases();
  const pageItems = paginate(all, PurchaseState.page, PurchaseState.pageSize);
  const tbody     = document.getElementById('purchaseTableBody');

  tbody.innerHTML = !pageItems.length
    ? `<tr class="empty-row"><td colspan="9">No purchase records found.</td></tr>`
    : pageItems.map(r => `
        <tr>
          <td>${formatDate(r.date)}</td>
          <td class="num">${formatQty(r.tss_quantity)}</td>
          <td class="num">${formatCurrency(r.tss_amount)}</td>
          <td class="num">${formatQty(r.tms_quantity)}</td>
          <td class="num">${formatCurrency(r.tms_amount)}</td>
          <td class="num"><strong>${formatQty((Number(r.tss_quantity)||0)+(Number(r.tms_quantity)||0))}</strong></td>
          <td class="num">${formatCurrency(r.total_amount)}</td>
          <td class="num">${formatCurrency(r.slnk_amount)}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" onclick="editPurchase(${r.id})">✎ Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deletePurchase(${r.id})">🗑 Delete</button>
            </div>
          </td>
        </tr>`).join('');

  renderPagination('purchasePagination', all.length, PurchaseState.pageSize, PurchaseState.page, async p => {
    PurchaseState.page = p;
    await renderPurchaseTable();
  });
}

/* ── Filters ──────────────────────────────────────────── */
document.getElementById('purchaseSearch').addEventListener('input', async e => {
  PurchaseState.search = e.target.value; PurchaseState.page = 1; await renderPurchaseTable();
});
document.getElementById('purchaseFilterDate').addEventListener('change', async e => {
  PurchaseState.filterDate = e.target.value; PurchaseState.page = 1; await renderPurchaseTable();
});
document.getElementById('purchaseFilterMonth').addEventListener('change', async e => {
  PurchaseState.filterMonth = e.target.value; PurchaseState.page = 1; await renderPurchaseTable();
});
document.getElementById('purchaseClearFilters').addEventListener('click', async () => {
  PurchaseState.search = ''; PurchaseState.filterDate = ''; PurchaseState.filterMonth = '';
  ['purchaseSearch','purchaseFilterDate','purchaseFilterMonth'].forEach(id => document.getElementById(id).value = '');
  PurchaseState.page = 1; await renderPurchaseTable();
});
