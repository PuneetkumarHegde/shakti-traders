/* ============================================================
   dashboard.js  v5
   • My Kamai privacy toggle (eye icon, persisted in localStorage)
   • SLNK from stored values (no auto-calc)
============================================================ */

const KAMAI_VIS_KEY = 'st_kamai_visible';

function isKamaiVisible() {
  return localStorage.getItem(KAMAI_VIS_KEY) !== 'false';
}

function applyKamaiVisibility(amount) {
  const visible = isKamaiVisible();
  const amtEl   = document.getElementById('statMyKamai');
  const btnEl   = document.getElementById('kamaiToggleBtn');
  if (amtEl) {
    amtEl.textContent      = visible ? formatCurrency(amount) : '₹••••••••';
    amtEl.dataset.amount   = amount;
  }
  if (btnEl) btnEl.textContent = visible ? '👁️' : '👁️‍🗨️';
}

// Wire toggle button once
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('kamaiToggleBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = !isKamaiVisible();
      localStorage.setItem(KAMAI_VIS_KEY, next ? 'true' : 'false');
      const stored = Number(document.getElementById('statMyKamai').dataset.amount || 0);
      applyKamaiVisibility(stored);
    });
  }
});

async function refreshDashboard() {
  const [purchases, sellings] = await Promise.all([
    DB.getAll('purchase'),
    DB.getAll('selling')
  ]);

  const totalPurchaseQty = purchases.reduce((s, r) =>
    s + ((Number(r.tss_quantity)||0) + (Number(r.tms_quantity)||0)), 0);
  const totalSoldQty     = sellings.reduce((s, r)  => s + (Number(r.selling_quantity)||0), 0);
  const totalPurchaseAmt = purchases.reduce((s, r) => s + (Number(r.total_amount)||0),    0);
  const totalSalesAmt    = sellings.reduce((s, r)  => s + (Number(r.amount)||0),          0);
  const totalSlnkAmt     = purchases.reduce((s, r) => s + (Number(r.slnk_amount)||0),     0);

  const manual       = (typeof getManualSold === 'function') ? await getManualSold() : { tss: 0, tms: 0 };
  const currentStock = totalPurchaseQty - (Number(manual.tss)||0) - (Number(manual.tms)||0);

  const currentSlnkAmt = totalSlnkAmt - totalSalesAmt;
  const myKamai        = totalSlnkAmt - totalPurchaseAmt;

  document.getElementById('statStock').textContent          = formatQty(currentStock);
  document.getElementById('statPurchaseQty').textContent    = formatQty(totalPurchaseQty);
  document.getElementById('statSoldQty').textContent        = formatQty(totalSoldQty);
  document.getElementById('statPurchaseAmt').textContent    = formatCurrency(totalPurchaseAmt);
  document.getElementById('statSalesAmt').textContent       = formatCurrency(totalSalesAmt);
  document.getElementById('statSlnkAmt').textContent        = formatCurrency(totalSlnkAmt);
  document.getElementById('statCurrentSlnkAmt').textContent = formatCurrency(currentSlnkAmt);

  // My Kamai — apply privacy preference
  applyKamaiVisibility(myKamai);
}
