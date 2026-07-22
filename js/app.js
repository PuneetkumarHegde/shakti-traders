/* ============================================================
   app.js — Navigation & init
   MIGRATED: switchView and DOMContentLoaded are now async.
============================================================ */

async function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');

  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  showLoading(true);
  try {
    if (viewName === 'dashboard') await refreshDashboard();
    if (viewName === 'purchase')  await renderPurchaseTable();
    if (viewName === 'selling')   await renderSellingTable();
    if (viewName === 'notes')     await renderNotesTable();
    // 'reports', 'combine', 'backup' need no async data load
  } finally {
    showLoading(false);
  }

  document.querySelector('.sidebar').classList.remove('open');
}

document.querySelectorAll('[data-view]').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.view));
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
});

window.addEventListener('DOMContentLoaded', async () => {
  if (AUTH.isLoggedIn()) {
    await showApp();
  }
});
