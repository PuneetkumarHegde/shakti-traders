/* ============================================================
   app.js — navigation & init
============================================================ */

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');

  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'dashboard') refreshDashboard();
  if (viewName === 'purchase') renderPurchaseTable();
  if (viewName === 'selling') renderSellingTable();
  if (viewName === 'reports') populateSingleEntryDropdown();

  document.querySelector('.sidebar').classList.remove('open');
}

document.querySelectorAll('[data-view]').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.view));
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
});

window.addEventListener('DOMContentLoaded', () => {
  if (AUTH.isLoggedIn()) {
    showApp();
  }
});
