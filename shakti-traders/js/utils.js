/* ============================================================
   utils.js — shared helpers
============================================================ */

function toast(msg, type = 'success') {
  const box = document.getElementById('toastBox');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

function roundNum(n, decimals = 2) {
  const num = Number(n) || 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

function formatCurrency(n) {
  const num = roundNum(n, 2);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatQty(n) {
  const num = roundNum(n, 2);
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalBody').innerHTML = '';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

let _confirmCallback = null;
function confirmAction(text, onConfirm) {
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmOverlay').classList.remove('hidden');
  _confirmCallback = onConfirm;
}
document.getElementById('confirmCancel').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.add('hidden');
  _confirmCallback = null;
});
document.getElementById('confirmOk').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.add('hidden');
  if (_confirmCallback) _confirmCallback();
  _confirmCallback = null;
});

/* ---------- Simple pagination helper ---------- */
function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function renderPagination(containerId, totalItems, pageSize, currentPage, onPageClick) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return;
  for (let p = 1; p <= totalPages; p++) {
    const btn = document.createElement('button');
    btn.textContent = p;
    if (p === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => onPageClick(p));
    container.appendChild(btn);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
