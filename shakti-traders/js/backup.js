/* ============================================================
   backup.js — in-device backup / restore
============================================================ */

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('exportBackupBtn').addEventListener('click', () => {
  const data = DB.exportAll();
  downloadJson(data, `Shakti_Traders_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  toast('Backup downloaded to your device.');
});

document.getElementById('backupPurchaseBtn').addEventListener('click', () => {
  downloadJson(DB.getAll('purchase'), `Purchase_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  toast('Purchase data exported.');
});

document.getElementById('backupSellingBtn').addEventListener('click', () => {
  downloadJson(DB.getAll('selling'), `Selling_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  toast('Selling data exported.');
});

document.getElementById('restoreBackupBtn').addEventListener('click', () => {
  const input = document.getElementById('restoreFileInput');
  const file = input.files[0];
  if (!file) return toast('Please choose a backup file first.', 'error');

  confirmAction('Restoring will replace all current data with the backup file. Continue?', () => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        DB.importAll(data);
        toast('Backup restored successfully.');
        refreshDashboard();
        renderPurchaseTable();
        renderSellingTable();
        input.value = '';
      } catch (err) {
        console.error(err);
        toast('Invalid or corrupted backup file.', 'error');
      }
    };
    reader.readAsText(file);
  });
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  confirmAction('This will permanently erase all purchase and selling data from this browser. Continue?', () => {
    DB.clearAll();
    toast('All data cleared.');
    refreshDashboard();
    renderPurchaseTable();
    renderSellingTable();
  });
});
