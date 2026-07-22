/* ============================================================
   notes.js — Notes module (PAKKA / Quantity grouped columns)
   Same UI conventions as Purchase / Selling modules.
   Stored in Supabase table 'notes'.
============================================================ */

const NotesState = {
  page: 1,
  pageSize: 8,
  search: '',
  filterDate: ''
};

/* ---------- Form HTML ---------- */
function noteFormHtml(record) {
  const r = record || {};
  return `
    <form id="noteForm">
      <label>Date
        <input type="date" id="n_date" value="${r.date || ''}" required>
      </label>
      <label>PAKKA — TSS
        <input type="number" step="any" min="0" id="n_pakka_tss" value="${r.pakka_tss ?? ''}">
      </label>
      <label>PAKKA — TMS
        <input type="number" step="any" min="0" id="n_pakka_tms" value="${r.pakka_tms ?? ''}">
      </label>
      <label>Quantity (KG) — TSS
        <input type="number" step="any" min="0" id="n_qty_tss" value="${r.qty_tss ?? ''}">
      </label>
      <label>Quantity (KG) — TMS
        <input type="number" step="any" min="0" id="n_qty_tms" value="${r.qty_tms ?? ''}">
      </label>
      <label>Description
        <textarea id="n_desc" rows="4" placeholder="Type anything...">${escapeHtml(r.description || '')}</textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="noteCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${record ? 'Update' : 'Save'} Note</button>
      </div>
    </form>
  `;
}

function bindNoteFormEvents(editId) {
  document.getElementById('noteCancel').addEventListener('click', closeModal);

  document.getElementById('noteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const record = {
      date:        document.getElementById('n_date').value,
      pakka_tss:   Number(document.getElementById('n_pakka_tss').value) || 0,
      pakka_tms:   Number(document.getElementById('n_pakka_tms').value) || 0,
      qty_tss:     Number(document.getElementById('n_qty_tss').value) || 0,
      qty_tms:     Number(document.getElementById('n_qty_tms').value) || 0,
      description: document.getElementById('n_desc').value.trim()
    };

    showLoading(true);
    try {
      if (editId) {
        await DB.update('notes', editId, record);
        toast('Note updated successfully.');
      } else {
        await DB.insert('notes', record);
        toast('Note added successfully.');
      }
      closeModal();
      NotesState.page = 1;
      await renderNotesTable();
    } catch (err) {
      console.error(err);
      toast('Failed to save note. Please try again.', 'error');
    } finally {
      showLoading(false);
    }
  });
}

document.getElementById('addNoteBtn').addEventListener('click', () => {
  openModal('Add Note', noteFormHtml(null));
  bindNoteFormEvents(null);
});

async function editNote(id) {
  showLoading(true);
  try {
    const record = await DB.getById('notes', id);
    if (!record) return;
    openModal('Edit Note', noteFormHtml(record));
    bindNoteFormEvents(id);
  } finally {
    showLoading(false);
  }
}

async function deleteNote(id) {
  confirmAction('Delete this note? This cannot be undone.', async () => {
    showLoading(true);
    try {
      await DB.remove('notes', id);
      toast('Note deleted.');
      await renderNotesTable();
    } catch (err) {
      console.error(err);
      toast('Failed to delete note.', 'error');
    } finally {
      showLoading(false);
    }
  });
}

async function getFilteredNotes() {
  let list = (await DB.getAll('notes')).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (NotesState.search) {
    const s = NotesState.search.toLowerCase();
    list = list.filter(r =>
      String(r.date).toLowerCase().includes(s) ||
      String(r.description || '').toLowerCase().includes(s)
    );
  }
  if (NotesState.filterDate) list = list.filter(r => r.date === NotesState.filterDate);
  return list;
}

async function renderNotesTable() {
  const all       = await getFilteredNotes();
  const pageItems = paginate(all, NotesState.page, NotesState.pageSize);
  const tbody     = document.getElementById('notesTableBody');

  if (!pageItems.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No notes found.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(r => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td class="num">${formatQty(r.pakka_tss)}</td>
        <td class="num">${formatQty(r.pakka_tms)}</td>
        <td class="num">${formatQty(r.qty_tss)}</td>
        <td class="num">${formatQty(r.qty_tms)}</td>
        <td class="wrap">${escapeHtml(r.description || '-')}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick="editNote(${r.id})">✎ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteNote(${r.id})">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderPagination('notesPagination', all.length, NotesState.pageSize, NotesState.page, async (p) => {
    NotesState.page = p;
    await renderNotesTable();
  });
}

/* ---------- Filter controls ---------- */
document.getElementById('noteSearch').addEventListener('input', async (e) => {
  NotesState.search = e.target.value;
  NotesState.page    = 1;
  await renderNotesTable();
});
document.getElementById('noteFilterDate').addEventListener('change', async (e) => {
  NotesState.filterDate = e.target.value;
  NotesState.page        = 1;
  await renderNotesTable();
});
document.getElementById('noteClearFilters').addEventListener('click', async () => {
  NotesState.search     = '';
  NotesState.filterDate = '';
  document.getElementById('noteSearch').value     = '';
  document.getElementById('noteFilterDate').value = '';
  NotesState.page = 1;
  await renderNotesTable();
});
