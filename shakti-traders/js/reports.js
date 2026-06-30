/* ============================================================
   reports.js — PDF & Excel report generation
============================================================ */

const COMPANY_NAME = 'SHAKTI TRADERS';

function addReportHeader(doc, title) {
  doc.setFontSize(16);
  doc.setTextColor(11, 61, 38);
  doc.text(COMPANY_NAME, 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(title, 14, 25);
  doc.setFontSize(9);
  doc.text('Generated on: ' + new Date().toLocaleString('en-IN'), 14, 31);
  doc.setDrawColor(11, 61, 38);
  doc.line(14, 34, 196, 34);
}

function addReportFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`${COMPANY_NAME} — Confidential Business Report`, 14, 290);
    doc.text(`Page ${i} of ${pageCount}`, 180, 290);
  }
}

function exportPurchasePDF(records, title = 'Purchase Report') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  addReportHeader(doc, title);

  const rows = records.map(r => {
    const tssRem = r.tss_remaining_quantity ?? (Number(r.tss_quantity || 0) - Number(r.tss_sold_quantity || 0));
    const tmsRem = r.tms_remaining_quantity ?? (Number(r.tms_quantity || 0) - Number(r.tms_sold_quantity || 0));
    return [
      formatDate(r.date),
      r.tss_quantity, r.tss_sold_quantity || 0, tssRem, formatCurrency(r.tss_amount),
      r.tms_quantity, r.tms_sold_quantity || 0, tmsRem, formatCurrency(r.tms_amount),
      r.total_quantity, formatCurrency(r.total_amount), formatCurrency(r.slnk_amount)
    ];
  });
  const totals = records.reduce((a, r) => {
    const tssRem = r.tss_remaining_quantity ?? (Number(r.tss_quantity || 0) - Number(r.tss_sold_quantity || 0));
    const tmsRem = r.tms_remaining_quantity ?? (Number(r.tms_quantity || 0) - Number(r.tms_sold_quantity || 0));
    return {
      tssq: a.tssq + Number(r.tss_quantity || 0), tsssold: a.tsssold + Number(r.tss_sold_quantity || 0),
      tssrem: a.tssrem + Number(tssRem || 0), tssa: a.tssa + Number(r.tss_amount || 0),
      tmsq: a.tmsq + Number(r.tms_quantity || 0), tmssold: a.tmssold + Number(r.tms_sold_quantity || 0),
      tmsrem: a.tmsrem + Number(tmsRem || 0), tmsa: a.tmsa + Number(r.tms_amount || 0),
      tq: a.tq + Number(r.total_quantity || 0), ta: a.ta + Number(r.total_amount || 0), sa: a.sa + Number(r.slnk_amount || 0)
    };
  }, { tssq: 0, tsssold: 0, tssrem: 0, tssa: 0, tmsq: 0, tmssold: 0, tmsrem: 0, tmsa: 0, tq: 0, ta: 0, sa: 0 });
  rows.push(['TOTAL', totals.tssq, totals.tsssold, totals.tssrem, formatCurrency(totals.tssa),
    totals.tmsq, totals.tmssold, totals.tmsrem, formatCurrency(totals.tmsa),
    totals.tq, formatCurrency(totals.ta), formatCurrency(totals.sa)]);

  doc.autoTable({
    startY: 40,
    head: [['Date', 'TSS Purch', 'TSS Sold', 'TSS Rem', 'TSS Amt', 'TMS Purch', 'TMS Sold', 'TMS Rem', 'TMS Amt', 'Total Qty', 'Total Amt', 'SLNK Amt']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 92, 56] },
    styles: { fontSize: 6.5 }
  });
  addReportFooter(doc);
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

function exportSellingPDF(records, title = 'Selling Report') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  addReportHeader(doc, title);

  const rows = records.map(r => [
    formatDate(r.date), r.available_quantity, r.selling_quantity, formatCurrency(r.amount),
    r.description || '-', r.remaining_quantity
  ]);
  const totalAmt = records.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalQty = records.reduce((s, r) => s + Number(r.selling_quantity || 0), 0);
  rows.push(['TOTAL', '-', totalQty, formatCurrency(totalAmt), '-', '-']);

  doc.autoTable({
    startY: 40,
    head: [['Date', 'Available Qty', 'Selling Qty', 'Amount', 'Description', 'Remaining Qty']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 92, 56] },
    styles: { fontSize: 8 }
  });
  addReportFooter(doc);
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

function exportToExcel(sheetsData, filename) {
  const wb = XLSX.utils.book_new();
  sheetsData.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, filename);
}

function purchaseRowsForExcel(records) {
  return records.map(r => {
    const tssRem = r.tss_remaining_quantity ?? (Number(r.tss_quantity || 0) - Number(r.tss_sold_quantity || 0));
    const tmsRem = r.tms_remaining_quantity ?? (Number(r.tms_quantity || 0) - Number(r.tms_sold_quantity || 0));
    return {
      Date: formatDate(r.date),
      'TSS Purchased': r.tss_quantity, 'TSS Sold': r.tss_sold_quantity || 0, 'TSS Remaining': tssRem, 'TSS Amount': r.tss_amount,
      'TMS Purchased': r.tms_quantity, 'TMS Sold': r.tms_sold_quantity || 0, 'TMS Remaining': tmsRem, 'TMS Amount': r.tms_amount,
      'Total Quantity': r.total_quantity, 'Total Amount': r.total_amount, 'SLNK Amount': r.slnk_amount
    };
  });
}
function sellingRowsForExcel(records) {
  return records.map(r => ({
    Date: formatDate(r.date), 'Available Qty': r.available_quantity, 'Selling Qty': r.selling_quantity,
    Amount: r.amount, Description: r.description, 'Remaining Qty': r.remaining_quantity
  }));
}

function populateSingleEntryDropdown() {
  const type = document.getElementById('singleEntryType').value;
  const select = document.getElementById('singleEntryId');
  const records = DB.getAll(type).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  select.innerHTML = records.map(r => `<option value="${r.id}">#${r.id} — ${formatDate(r.date)}</option>`).join('')
    || '<option value="">No records</option>';
}
document.getElementById('singleEntryType').addEventListener('change', populateSingleEntryDropdown);

document.querySelectorAll('[data-report]').forEach(btn => {
  btn.addEventListener('click', () => {
    const reportType = btn.dataset.report;
    const format = btn.dataset.format;
    handleReportExport(reportType, format);
  });
});

function handleReportExport(type, format) {
  showLoading(true);
  setTimeout(() => {
    try {
      if (type === 'purchase') {
        const records = DB.getAll('purchase').slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!records.length) return toast('No purchase records to export.', 'error');
        format === 'pdf' ? exportPurchasePDF(records) : exportToExcel([{ name: 'Purchase', rows: purchaseRowsForExcel(records) }], 'Purchase_Report.xlsx');
      }
      else if (type === 'selling') {
        const records = DB.getAll('selling').slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!records.length) return toast('No selling records to export.', 'error');
        format === 'pdf' ? exportSellingPDF(records) : exportToExcel([{ name: 'Selling', rows: sellingRowsForExcel(records) }], 'Selling_Report.xlsx');
      }
      else if (type === 'monthly') {
        const month = document.getElementById('monthlyReportMonth').value;
        if (!month) return toast('Please select a month.', 'error');
        const purchases = DB.getAll('purchase').filter(r => (r.date || '').slice(0, 7) === month);
        const sellings = DB.getAll('selling').filter(r => (r.date || '').slice(0, 7) === month);
        if (!purchases.length && !sellings.length) return toast('No records found for selected month.', 'error');
        if (format === 'pdf') {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          addReportHeader(doc, `Monthly Report — ${month}`);
          doc.autoTable({
            startY: 40, head: [['Purchase Date', 'Total Qty', 'Total Amt', 'SLNK Amt']],
            body: purchases.map(r => [formatDate(r.date), r.total_quantity, formatCurrency(r.total_amount), formatCurrency(r.slnk_amount)]),
            theme: 'striped', headStyles: { fillColor: [15, 92, 56] }, styles: { fontSize: 8 }
          });
          doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10, head: [['Selling Date', 'Selling Qty', 'Amount', 'Remaining Qty']],
            body: sellings.map(r => [formatDate(r.date), r.selling_quantity, formatCurrency(r.amount), r.remaining_quantity]),
            theme: 'striped', headStyles: { fillColor: [15, 92, 56] }, styles: { fontSize: 8 }
          });
          addReportFooter(doc);
          doc.save(`Monthly_Report_${month}.pdf`);
        } else {
          exportToExcel([
            { name: 'Purchase', rows: purchaseRowsForExcel(purchases) },
            { name: 'Selling', rows: sellingRowsForExcel(sellings) }
          ], `Monthly_Report_${month}.xlsx`);
        }
      }
      else if (type === 'single') {
        const entryType = document.getElementById('singleEntryType').value;
        const id = document.getElementById('singleEntryId').value;
        if (!id) return toast('No entry selected.', 'error');
        const record = DB.getById(entryType, id);
        if (!record) return toast('Entry not found.', 'error');
        entryType === 'purchase' ? exportPurchasePDF([record], `Purchase_Entry_${id}`) : exportSellingPDF([record], `Selling_Entry_${id}`);
      }
      else if (type === 'complete') {
        const purchases = DB.getAll('purchase').slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        const sellings = DB.getAll('selling').slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!purchases.length && !sellings.length) return toast('No records to export.', 'error');
        if (format === 'pdf') {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          addReportHeader(doc, 'Complete Business Report');
          doc.setFontSize(11); doc.setTextColor(15, 92, 56); doc.text('Purchase Records', 14, 40);
          doc.autoTable({
            startY: 44, head: [['Date', 'Total Qty', 'Total Amt', 'SLNK Amt']],
            body: purchases.map(r => [formatDate(r.date), r.total_quantity, formatCurrency(r.total_amount), formatCurrency(r.slnk_amount)]),
            theme: 'striped', headStyles: { fillColor: [15, 92, 56] }, styles: { fontSize: 8 }
          });
          const y2 = doc.lastAutoTable.finalY + 12;
          doc.setFontSize(11); doc.setTextColor(15, 92, 56); doc.text('Selling Records', 14, y2);
          doc.autoTable({
            startY: y2 + 4, head: [['Date', 'Selling Qty', 'Amount', 'Remaining Qty']],
            body: sellings.map(r => [formatDate(r.date), r.selling_quantity, formatCurrency(r.amount), r.remaining_quantity]),
            theme: 'striped', headStyles: { fillColor: [15, 92, 56] }, styles: { fontSize: 8 }
          });
          addReportFooter(doc);
          doc.save('Complete_Report.pdf');
        } else {
          exportToExcel([
            { name: 'Purchase', rows: purchaseRowsForExcel(purchases) },
            { name: 'Selling', rows: sellingRowsForExcel(sellings) }
          ], 'Complete_Report.xlsx');
        }
      }
      toast('Report generated successfully.');
    } catch (err) {
      console.error(err);
      toast('Failed to generate report.', 'error');
    } finally {
      showLoading(false);
    }
  }, 200);
}
