/* ============================================================
   combine-pdf.js — Client-side PDF merge utility
   Uses pdf-lib (loaded via CDN in index.html).
   NO data is uploaded to Supabase — 100% browser-local.
============================================================ */

(function () {
  // Each item: { file: File, id: string }
  let pdfFiles = [];

  const fileInput   = document.getElementById('cpfFileInput');
  const fileList    = document.getElementById('cpfFileList');
  const countLabel  = document.getElementById('cpfCount');
  const mergeBtn    = document.getElementById('cpfMergeBtn');
  const clearBtn    = document.getElementById('cpfClearBtn');

  /* ── Add files ─────────────────────────────────────────── */
  fileInput.addEventListener('change', () => {
    const added = Array.from(fileInput.files);
    let rejected = 0;
    added.forEach(f => {
      if (f.type !== 'application/pdf') { rejected++; return; }
      pdfFiles.push({ file: f, id: Math.random().toString(36).slice(2) });
    });
    if (rejected) toast(`${rejected} non-PDF file(s) were ignored.`, 'error');
    fileInput.value = '';
    renderFileList();
  });

  /* ── Clear all ──────────────────────────────────────────── */
  clearBtn.addEventListener('click', () => {
    pdfFiles = [];
    renderFileList();
  });

  /* ── Render list ────────────────────────────────────────── */
  function renderFileList() {
    countLabel.textContent = pdfFiles.length
      ? `${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''} selected`
      : 'No files selected';

    mergeBtn.disabled = pdfFiles.length < 2;

    if (!pdfFiles.length) {
      fileList.innerHTML = '<p class="cpf-empty">No PDFs added yet. Click "Choose PDF Files" to add.</p>';
      return;
    }

    fileList.innerHTML = pdfFiles.map((item, idx) => `
      <div class="cpf-item" draggable="true" data-id="${item.id}">
        <span class="cpf-drag-handle" title="Drag to reorder">⠿</span>
        <span class="cpf-name" title="${escapeHtml(item.file.name)}">
          ${escapeHtml(item.file.name)}
          <small>(${(item.file.size / 1024).toFixed(1)} KB)</small>
        </span>
        <div class="cpf-btns">
          <button class="btn btn-ghost btn-sm" onclick="cpfMove('${item.id}',-1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-ghost btn-sm" onclick="cpfMove('${item.id}',1)"  ${idx === pdfFiles.length-1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-danger btn-sm" onclick="cpfRemove('${item.id}')" title="Remove">✕</button>
        </div>
      </div>
    `).join('');

    bindDragDrop();
  }

  /* ── Move up/down (exposed globally) ─────────────────────── */
  window.cpfMove = function (id, dir) {
    const idx = pdfFiles.findIndex(f => f.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pdfFiles.length) return;
    [pdfFiles[idx], pdfFiles[newIdx]] = [pdfFiles[newIdx], pdfFiles[idx]];
    renderFileList();
  };

  /* ── Remove (exposed globally) ─────────────────────────── */
  window.cpfRemove = function (id) {
    pdfFiles = pdfFiles.filter(f => f.id !== id);
    renderFileList();
  };

  /* ── Drag & Drop reorder ────────────────────────────────── */
  let dragSrcId = null;

  function bindDragDrop() {
    document.querySelectorAll('.cpf-item').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragSrcId = el.dataset.id;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        dragSrcId = null;
        document.querySelectorAll('.cpf-item').forEach(x => x.classList.remove('drag-over'));
      });
      el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.cpf-item').forEach(x => x.classList.remove('drag-over'));
        el.classList.add('drag-over');
      });
      el.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrcId || dragSrcId === el.dataset.id) return;
        const srcIdx  = pdfFiles.findIndex(f => f.id === dragSrcId);
        const destIdx = pdfFiles.findIndex(f => f.id === el.dataset.id);
        if (srcIdx < 0 || destIdx < 0) return;
        const [moved] = pdfFiles.splice(srcIdx, 1);
        pdfFiles.splice(destIdx, 0, moved);
        renderFileList();
      });
    });
  }

  /* ── Merge ──────────────────────────────────────────────── */
  mergeBtn.addEventListener('click', async () => {
    if (pdfFiles.length < 2) return toast('Please add at least 2 PDF files to merge.', 'error');
    showLoading(true);
    try {
      const { PDFDocument } = PDFLib;
      const merged = await PDFDocument.create();

      for (const item of pdfFiles) {
        const buf  = await item.file.arrayBuffer();
        const src  = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }

      const mergedBytes = await merged.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Merged_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`${pdfFiles.length} PDFs merged and downloaded successfully.`);
    } catch (err) {
      console.error(err);
      toast('Failed to merge PDFs. One or more files may be corrupt or password-protected.', 'error');
    } finally {
      showLoading(false);
    }
  });

  // Initial render
  renderFileList();
})();
