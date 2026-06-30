/* ============================================================
   dashboard.js — summary stats
   --- MODIFIED ---
   Current stock now uses the overall manual sold totals
   (TSS + TMS) from localStorage instead of per-day sold values.
============================================================ */

function refreshDashboard() {
  const purchases = DB.getAll('purchase');
  const sellings  = DB.getAll('selling');

  const totalPurchaseQty = purchases.reduce((s, r) => s + (Number(r.total_quantity) || Number(r.tss_quantity || 0) + Number(r.tms_quantity || 0)), 0);
  const totalSoldQty     = sellings.reduce((s, r) => s + (Number(r.selling_quantity) || 0), 0);
  const totalPurchaseAmt = purchases.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
  const totalSalesAmt    = sellings.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalSlnkAmt     = purchases.reduce((s, r) => s + (Number(r.slnk_amount) || 0), 0);

  // Current stock = total purchased - overall manual sold (TSS + TMS)
  const manual = (typeof getManualSold === 'function') ? getManualSold() : { tss: 0, tms: 0 };
  const currentStock = totalPurchaseQty - (Number(manual.tss) || 0) - (Number(manual.tms) || 0);

  const currentSlnkAmt = totalSlnkAmt - totalSalesAmt;
  const myKamai        = totalSlnkAmt - totalPurchaseAmt;

  document.getElementById('statStock').textContent          = formatQty(currentStock);
  document.getElementById('statPurchaseQty').textContent    = formatQty(totalPurchaseQty);
  document.getElementById('statSoldQty').textContent        = formatQty(totalSoldQty);
  document.getElementById('statPurchaseAmt').textContent    = formatCurrency(totalPurchaseAmt);
  document.getElementById('statSalesAmt').textContent       = formatCurrency(totalSalesAmt);
  document.getElementById('statSlnkAmt').textContent        = formatCurrency(totalSlnkAmt);
  document.getElementById('statCurrentSlnkAmt').textContent = formatCurrency(currentSlnkAmt);
  document.getElementById('statMyKamai').textContent        = formatCurrency(myKamai);
}
