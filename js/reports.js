/* ============================================================
   reports.js — PDF & Excel reports
   v4 changes:
   • Single Entry Report removed
   • Total Quantity column added to purchase reports
   • SLNK Amount is manual — display stored value as-is
   • Currency formatted with Intl.NumberFormat (no spacing bugs)
============================================================ */

const COMPANY_NAME = 'SHAKTI TRADERS';

function addReportHeader(doc, title) {
  doc.setFontSize(16); doc.setTextColor(11, 61, 38);
  doc.text(COMPANY_NAME, 14, 18);
  doc.setFontSize(11); doc.setTextColor(80, 80, 80);
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
    doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text(`${COMPANY_NAME} \u2014 Confidential Business Report`, 14, 290);
    doc.text(`Page ${i} of ${pageCount}`, 180, 290);
  }
}

/* -- PDF currency: plain string, no ₹ symbol issues in jsPDF -- */
function pdfCur(n) {
  const num = Math.ceil(Number(n) || 0);
  return 'Rs.' + new Intl.NumberFormat('en-IN', { useGrouping: true, maximumFractionDigits: 0 }).format(num);
}

/* -- Highlight GRAND TOTAL rows in every PDF report table --
   Passed as `didParseCell` to every doc.autoTable() call so the
   summary row is bold, larger, and high-contrast in all reports. */
function highlightGrandTotalRow(data) {
  if (data.section !== 'body') return;
  const firstCell = data.row.raw && data.row.raw[0];
  if (typeof firstCell === 'string' && firstCell.toUpperCase().includes('GRAND TOTAL')) {
    data.cell.styles.fillColor  = [15, 92, 56];   // dark green background
    data.cell.styles.textColor  = [255, 255, 255]; // white text
    data.cell.styles.fontStyle  = 'bold';
    data.cell.styles.fontSize   = (data.cell.styles.fontSize || 8) + 1.5;
    data.cell.styles.lineWidth  = 0.4;
    data.cell.styles.lineColor  = [255, 255, 255];
  }
}

function exportPurchasePDF(records, title = 'Purchase Report') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  addReportHeader(doc, title);

  const rows = records.map(r => [
    formatDate(r.date),
    formatQty(r.tss_quantity),
    pdfCur(r.tss_amount),
    formatQty(r.tms_quantity),
    pdfCur(r.tms_amount),
    formatQty((Number(r.tss_quantity)||0) + (Number(r.tms_quantity)||0)),
    pdfCur(r.total_amount),
    pdfCur(r.slnk_amount)
  ]);

  const T = records.reduce((a, r) => ({
    tssq: a.tssq + (Number(r.tss_quantity)||0),
    tssa: a.tssa + (Number(r.tss_amount)||0),
    tmsq: a.tmsq + (Number(r.tms_quantity)||0),
    tmsa: a.tmsa + (Number(r.tms_amount)||0),
    tq:   a.tq   + ((Number(r.tss_quantity)||0) + (Number(r.tms_quantity)||0)),
    ta:   a.ta   + (Number(r.total_amount)||0),
    sa:   a.sa   + (Number(r.slnk_amount)||0)
  }), { tssq:0, tssa:0, tmsq:0, tmsa:0, tq:0, ta:0, sa:0 });

  rows.push(['GRAND TOTAL',
    formatQty(T.tssq), pdfCur(T.tssa),
    formatQty(T.tmsq), pdfCur(T.tmsa),
    formatQty(T.tq),   pdfCur(T.ta),   pdfCur(T.sa)
  ]);

  doc.autoTable({
    startY: 40,
    head: [['Date', 'TSS Qty', 'TSS Amt', 'TMS Qty', 'TMS Amt', 'Total Qty', 'Total Amt', 'SLNK Amt']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 92, 56] },
    styles: { fontSize: 7, halign: 'right' },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: highlightGrandTotalRow
  });
  addReportFooter(doc);
  doc.save(`${title.replace(/[\s()]/g, '_')}.pdf`);
}

function exportSellingPDF(records, title = 'Selling Report') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  addReportHeader(doc, title);

  const rows = records.map(r => [
    formatDate(r.date),
    r.bill_number || '-',
    formatQty(r.available_quantity),
    formatQty(r.selling_quantity),
    pdfCur(r.amount),
    r.description || '-',
    formatQty(r.remaining_quantity)
  ]);

  const totalAmt = records.reduce((s, r) => s + (Number(r.amount)||0), 0);
  const totalQty = records.reduce((s, r) => s + (Number(r.selling_quantity)||0), 0);
  rows.push(['GRAND TOTAL', '-', '-', formatQty(totalQty), pdfCur(totalAmt), '-', '-']);

  doc.autoTable({
    startY: 40,
    head: [['Date', 'Bill No.', 'Avail Qty', 'Sold Qty', 'Amount', 'Description', 'Remaining']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 92, 56] },
    styles: { fontSize: 8, halign: 'right' },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' }, 5: { halign: 'left' } },
    didParseCell: highlightGrandTotalRow
  });
  addReportFooter(doc);
  doc.save(`${title.replace(/[\s()]/g, '_')}.pdf`);
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
  const rows = records.map(r => ({
    'Date':           formatDate(r.date),
    'TSS Qty (kg)':   Number(r.tss_quantity)  || 0,
    'TSS Amount':     Number(r.tss_amount)     || 0,
    'TMS Qty (kg)':   Number(r.tms_quantity)   || 0,
    'TMS Amount':     Number(r.tms_amount)     || 0,
    'Total Qty (kg)': (Number(r.tss_quantity)||0) + (Number(r.tms_quantity)||0),
    'Total Amount':   Number(r.total_amount)   || 0,
    'SLNK Amount':    Number(r.slnk_amount)    || 0
  }));
  if (rows.length) {
    const sum = k => records.reduce((s, r) => s + (Number(r[k])||0), 0);
    rows.push({
      'Date':           'GRAND TOTAL',
      'TSS Qty (kg)':   sum('tss_quantity'),
      'TSS Amount':     sum('tss_amount'),
      'TMS Qty (kg)':   sum('tms_quantity'),
      'TMS Amount':     sum('tms_amount'),
      'Total Qty (kg)': sum('tss_quantity') + sum('tms_quantity'),
      'Total Amount':   sum('total_amount'),
      'SLNK Amount':    sum('slnk_amount')
    });
  }
  return rows;
}

function sellingRowsForExcel(records) {
  const rows = records.map(r => ({
    'Date':          formatDate(r.date),
    'Bill Number':   r.bill_number || '',
    'Available Qty': Number(r.available_quantity)  || 0,
    'Selling Qty':   Number(r.selling_quantity)    || 0,
    'Amount':        Number(r.amount)              || 0,
    'Description':   r.description                || '',
    'Remaining Qty': Number(r.remaining_quantity)  || 0
  }));
  if (rows.length) {
    const sum = k => records.reduce((s, r) => s + (Number(r[k])||0), 0);
    rows.push({
      'Date': 'GRAND TOTAL', 'Bill Number': '', 'Available Qty': '',
      'Selling Qty': sum('selling_quantity'), 'Amount': sum('amount'),
      'Description': '', 'Remaining Qty': ''
    });
  }
  return rows;
}

/* ── Report button wiring (data-report attributes) ───────── */
document.querySelectorAll('[data-report]').forEach(btn => {
  btn.addEventListener('click', () => handleReportExport(btn.dataset.report, btn.dataset.format));
});

async function handleReportExport(type, format) {
  showLoading(true);
  try {
    if (type === 'purchase') {
      const records = (await DB.getAll('purchase')).sort((a, b) => new Date(a.date) - new Date(b.date));
      if (!records.length) return toast('No purchase records to export.', 'error');
      format === 'pdf'
        ? exportPurchasePDF(records)
        : exportToExcel([{ name: 'Purchase', rows: purchaseRowsForExcel(records) }], 'Purchase_Report.xlsx');
    }
    else if (type === 'selling') {
      const records = (await DB.getAll('selling')).sort((a, b) => new Date(a.date) - new Date(b.date));
      if (!records.length) return toast('No selling records to export.', 'error');
      format === 'pdf'
        ? exportSellingPDF(records)
        : exportToExcel([{ name: 'Selling', rows: sellingRowsForExcel(records) }], 'Selling_Report.xlsx');
    }
    else if (type === 'monthly') {
      const month = document.getElementById('monthlyReportMonth').value;
      if (!month) return toast('Please select a month.', 'error');
      const purchases = (await DB.getAll('purchase')).filter(r => (r.date||'').slice(0,7) === month);
      const sellings  = (await DB.getAll('selling')).filter(r  => (r.date||'').slice(0,7) === month);
      if (!purchases.length && !sellings.length) return toast('No records found for selected month.', 'error');

      if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        addReportHeader(doc, `Monthly Report \u2014 ${month}`);

        if (purchases.length) {
          doc.setFontSize(10); doc.setTextColor(15,92,56);
          doc.text('Purchase Records', 14, 40);
          const pRows = purchases.map(r => [
            formatDate(r.date),
            formatQty((Number(r.tss_quantity)||0)+(Number(r.tms_quantity)||0)),
            pdfCur(r.total_amount),
            pdfCur(r.slnk_amount)
          ]);
          const pT = purchases.reduce((a,r) => ({
            q:  a.q  + ((Number(r.tss_quantity)||0)+(Number(r.tms_quantity)||0)),
            ta: a.ta + (Number(r.total_amount)||0),
            sa: a.sa + (Number(r.slnk_amount)||0)
          }), { q:0, ta:0, sa:0 });
          pRows.push(['GRAND TOTAL', formatQty(pT.q), pdfCur(pT.ta), pdfCur(pT.sa)]);
          doc.autoTable({ startY:44, head:[['Date','Total Qty','Total Amt','SLNK Amt']], body:pRows,
            theme:'striped', headStyles:{fillColor:[15,92,56]}, styles:{fontSize:8, halign:'right'},
            columnStyles:{0:{halign:'left'}}, didParseCell: highlightGrandTotalRow });
        }

        if (sellings.length) {
          const y2 = purchases.length ? doc.lastAutoTable.finalY + 12 : 40;
          doc.setFontSize(10); doc.setTextColor(15,92,56);
          doc.text('Selling Records', 14, y2);
          const sRows = sellings.map(r => [formatDate(r.date), r.bill_number || '-', formatQty(r.selling_quantity), pdfCur(r.amount), formatQty(r.remaining_quantity)]);
          const sT = sellings.reduce((a,r)=>({q:a.q+(Number(r.selling_quantity)||0),a2:a.a2+(Number(r.amount)||0)}),{q:0,a2:0});
          sRows.push(['GRAND TOTAL', '-', formatQty(sT.q), pdfCur(sT.a2), '-']);
          doc.autoTable({ startY:y2+4, head:[['Date','Bill No.','Selling Qty','Amount','Remaining Qty']], body:sRows,
            theme:'striped', headStyles:{fillColor:[15,92,56]}, styles:{fontSize:8, halign:'right'},
            columnStyles:{0:{halign:'left'},1:{halign:'left'}}, didParseCell: highlightGrandTotalRow });
        }
        addReportFooter(doc);
        doc.save(`Monthly_Report_${month}.pdf`);
      } else {
        exportToExcel([
          ...(purchases.length ? [{ name:'Purchase', rows: purchaseRowsForExcel(purchases) }] : []),
          ...(sellings.length  ? [{ name:'Selling',  rows: sellingRowsForExcel(sellings)   }] : [])
        ], `Monthly_Report_${month}.xlsx`);
      }
    }
    else if (type === 'complete') {
      const purchases = (await DB.getAll('purchase')).sort((a,b) => new Date(a.date)-new Date(b.date));
      const sellings  = (await DB.getAll('selling')).sort((a,b)  => new Date(a.date)-new Date(b.date));
      if (!purchases.length && !sellings.length) return toast('No records to export.', 'error');

      if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        addReportHeader(doc, 'Complete Business Report');
        let nextY = 40;

        if (purchases.length) {
          doc.setFontSize(10); doc.setTextColor(15,92,56); doc.text('Purchase Records', 14, nextY); nextY += 4;
          const cpRows = purchases.map(r => [
            formatDate(r.date),
            formatQty((Number(r.tss_quantity)||0)+(Number(r.tms_quantity)||0)),
            pdfCur(r.total_amount), pdfCur(r.slnk_amount)
          ]);
          const cpT = purchases.reduce((a,r)=>({q:a.q+((Number(r.tss_quantity)||0)+(Number(r.tms_quantity)||0)),ta:a.ta+(Number(r.total_amount)||0),sa:a.sa+(Number(r.slnk_amount)||0)}),{q:0,ta:0,sa:0});
          cpRows.push(['GRAND TOTAL', formatQty(cpT.q), pdfCur(cpT.ta), pdfCur(cpT.sa)]);
          doc.autoTable({ startY:nextY, head:[['Date','Total Qty','Total Amt','SLNK Amt']], body:cpRows,
            theme:'striped', headStyles:{fillColor:[15,92,56]}, styles:{fontSize:8,halign:'right'}, columnStyles:{0:{halign:'left'}}, didParseCell: highlightGrandTotalRow });
          nextY = doc.lastAutoTable.finalY + 12;
        }

        if (sellings.length) {
          doc.setFontSize(10); doc.setTextColor(15,92,56); doc.text('Selling Records', 14, nextY); nextY += 4;
          const csRows = sellings.map(r => [formatDate(r.date), r.bill_number || '-', formatQty(r.selling_quantity), pdfCur(r.amount), formatQty(r.remaining_quantity)]);
          const csT = sellings.reduce((a,r)=>({q:a.q+(Number(r.selling_quantity)||0),a2:a.a2+(Number(r.amount)||0)}),{q:0,a2:0});
          csRows.push(['GRAND TOTAL', '-', formatQty(csT.q), pdfCur(csT.a2), '-']);
          doc.autoTable({ startY:nextY, head:[['Date','Bill No.','Selling Qty','Amount','Remaining Qty']], body:csRows,
            theme:'striped', headStyles:{fillColor:[15,92,56]}, styles:{fontSize:8,halign:'right'}, columnStyles:{0:{halign:'left'},1:{halign:'left'}}, didParseCell: highlightGrandTotalRow });
        }
        addReportFooter(doc);
        doc.save('Complete_Report.pdf');
      } else {
        exportToExcel([
          ...(purchases.length ? [{ name:'Purchase', rows: purchaseRowsForExcel(purchases) }] : []),
          ...(sellings.length  ? [{ name:'Selling',  rows: sellingRowsForExcel(sellings)   }] : [])
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
}

/* ── Date Wise Report ────────────────────────────────────── */
async function handleDateWiseReport(format) {
  const fromDate = document.getElementById('dwrFromDate').value;
  const toDate   = document.getElementById('dwrToDate').value;
  const type     = document.getElementById('dwrType').value;

  if (!fromDate || !toDate) return toast('Please select both From Date and To Date.', 'error');
  if (fromDate > toDate)    return toast('From Date cannot be after To Date.', 'error');

  showLoading(true);
  try {
    const inRange = r => r.date >= fromDate && r.date <= toDate;
    const label   = `${formatDate(fromDate)} to ${formatDate(toDate)}`;

    if (type === 'purchase') {
      const records = (await DB.getAll('purchase')).filter(inRange).sort((a,b) => new Date(a.date)-new Date(b.date));
      if (!records.length) return toast(`No purchase records found between ${label}.`, 'error');
      format === 'pdf'
        ? exportPurchasePDF(records, `Purchase Report (${label})`)
        : exportToExcel([{ name:'Purchase', rows: purchaseRowsForExcel(records) }], `Purchase_DateWise_${fromDate}_${toDate}.xlsx`);
    }
    else if (type === 'selling') {
      const records = (await DB.getAll('selling')).filter(inRange).sort((a,b) => new Date(a.date)-new Date(b.date));
      if (!records.length) return toast(`No selling records found between ${label}.`, 'error');
      format === 'pdf'
        ? exportSellingPDF(records, `Selling Report (${label})`)
        : exportToExcel([{ name:'Selling', rows: sellingRowsForExcel(records) }], `Selling_DateWise_${fromDate}_${toDate}.xlsx`);
    }
    else if (type === 'complete') {
      const purchases = (await DB.getAll('purchase')).filter(inRange).sort((a,b) => new Date(a.date)-new Date(b.date));
      const sellings  = (await DB.getAll('selling')).filter(inRange).sort((a,b)  => new Date(a.date)-new Date(b.date));
      if (!purchases.length && !sellings.length) return toast(`No records found between ${label}.`, 'error');

      if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        addReportHeader(doc, `Complete Report (${label})`);
        let nextY = 40;

        if (purchases.length) {
          doc.setFontSize(10); doc.setTextColor(15,92,56); doc.text('Purchase Records', 14, nextY); nextY += 4;
          const pRows = purchases.map(r => [
            formatDate(r.date),
            formatQty((Number(r.tss_quantity)||0)+(Number(r.tms_quantity)||0)),
            pdfCur(r.total_amount), pdfCur(r.slnk_amount)
          ]);
          const pT = purchases.reduce((a,r)=>({q:a.q+((Number(r.tss_quantity)||0)+(Number(r.tms_quantity)||0)),ta:a.ta+(Number(r.total_amount)||0),sa:a.sa+(Number(r.slnk_amount)||0)}),{q:0,ta:0,sa:0});
          pRows.push(['GRAND TOTAL', formatQty(pT.q), pdfCur(pT.ta), pdfCur(pT.sa)]);
          doc.autoTable({ startY:nextY, head:[['Date','Total Qty','Total Amt','SLNK Amt']], body:pRows,
            theme:'striped', headStyles:{fillColor:[15,92,56]}, styles:{fontSize:8,halign:'right'}, columnStyles:{0:{halign:'left'}}, didParseCell: highlightGrandTotalRow });
          nextY = doc.lastAutoTable.finalY + 12;
        }

        if (sellings.length) {
          doc.setFontSize(10); doc.setTextColor(15,92,56); doc.text('Selling Records', 14, nextY); nextY += 4;
          const sRows = sellings.map(r => [formatDate(r.date), r.bill_number || '-', formatQty(r.selling_quantity), pdfCur(r.amount), formatQty(r.remaining_quantity)]);
          const sT = sellings.reduce((a,r)=>({q:a.q+(Number(r.selling_quantity)||0),a2:a.a2+(Number(r.amount)||0)}),{q:0,a2:0});
          sRows.push(['GRAND TOTAL', '-', formatQty(sT.q), pdfCur(sT.a2), '-']);
          doc.autoTable({ startY:nextY, head:[['Date','Bill No.','Selling Qty','Amount','Remaining Qty']], body:sRows,
            theme:'striped', headStyles:{fillColor:[15,92,56]}, styles:{fontSize:8,halign:'right'}, columnStyles:{0:{halign:'left'},1:{halign:'left'}}, didParseCell: highlightGrandTotalRow });
        }
        addReportFooter(doc);
        doc.save(`Complete_DateWise_${fromDate}_${toDate}.pdf`);
      } else {
        exportToExcel([
          ...(purchases.length ? [{ name:'Purchase', rows: purchaseRowsForExcel(purchases) }] : []),
          ...(sellings.length  ? [{ name:'Selling',  rows: sellingRowsForExcel(sellings)   }] : [])
        ], `Complete_DateWise_${fromDate}_${toDate}.xlsx`);
      }
    }
    toast('Date wise report generated successfully.');
  } catch (err) {
    console.error(err);
    toast('Failed to generate date wise report.', 'error');
  } finally {
    showLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dwrPdfBtn').addEventListener('click',   () => handleDateWiseReport('pdf'));
  document.getElementById('dwrExcelBtn').addEventListener('click', () => handleDateWiseReport('excel'));
});
