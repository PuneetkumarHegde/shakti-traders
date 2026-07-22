/* ============================================================
   backup.js — Backup / Restore
   MIGRATED: All DB calls are now async/await (Supabase).
   Download logic (Blob/URL) is unchanged.
============================================================ */

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('exportBackupBtn').addEventListener('click', async () => {
  showLoading(true);
  try {
    const data = await DB.exportAll();
    downloadJson(data, `Shakti_Traders_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup downloaded to your device.');
  } catch (err) {
    console.error(err);
    toast('Failed to export backup.', 'error');
  } finally {
    showLoading(false);
  }
});

document.getElementById('backupPurchaseBtn').addEventListener('click', async () => {
  showLoading(true);
  try {
    downloadJson(await DB.getAll('purchase'), `Purchase_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    toast('Purchase data exported.');
  } catch (err) {
    console.error(err);
    toast('Failed to export purchase data.', 'error');
  } finally {
    showLoading(false);
  }
});

document.getElementById('backupSellingBtn').addEventListener('click', async () => {
  showLoading(true);
  try {
    downloadJson(await DB.getAll('selling'), `Selling_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    toast('Selling data exported.');
  } catch (err) {
    console.error(err);
    toast('Failed to export selling data.', 'error');
  } finally {
    showLoading(false);
  }
});

document.getElementById('restoreBackupBtn').addEventListener('click', () => {
  const input = document.getElementById('restoreFileInput');
  const file  = input.files[0];
  if (!file) return toast('Please choose a backup file first.', 'error');

  confirmAction('Restoring will replace ALL current data with the backup file. Continue?', async () => {
    showLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        await DB.importAll(data);
        toast('Backup restored successfully.');
        await refreshDashboard();
        await renderPurchaseTable();
        await renderSellingTable();
        input.value = '';
      } catch (err) {
        console.error(err);
        toast('Invalid or corrupted backup file.', 'error');
      } finally {
        showLoading(false);
      }
    };
    reader.readAsText(file);
  });
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  confirmAction('This will permanently erase all purchase and selling data from Supabase. Continue?', async () => {
    showLoading(true);
    try {
      await DB.clearAll();
      toast('All data cleared.');
      await refreshDashboard();
      await renderPurchaseTable();
      await renderSellingTable();
    } catch (err) {
      console.error(err);
      toast('Failed to clear data.', 'error');
    } finally {
      showLoading(false);
    }
  });
});
