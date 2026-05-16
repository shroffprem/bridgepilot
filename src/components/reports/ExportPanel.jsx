import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const LOAN_COLS = [
  'disbursal_id', 'loan_number', 'disbursement_date', 'borrower_name', 'customer_mobile',
  'branch', 'cluster', 'zone', 'so_name',
  'principal', 'rate', 'charges', 'gst', 'outstanding', 'status',
  'closure_date', 'bank_name', 'account_number', 'ifsc_code',
  'net_weight', 'value_pledged', 'purpose',
  'approved_by_cluster', 'approved_by_zonal', 'submitted_by',
];

const COLLECTION_COLS = [
  'loan_number', 'borrower_name', 'branch', 'cluster',
  'credit_note_date', 'amount_collected', 'principal_component', 'charges_component', 'gst_component',
  'credit_note_number', 'bank_name', 'payment_mode', 'close_loan', 'notes', 'recorded_by',
];

function formatStatus(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildLoanRows(loans) {
  return loans.map(l => ({
    'Disbursal ID':        l.disbursal_id || '',
    'Loan Number':         l.loan_number || '',
    'Disbursement Date':   l.disbursement_date || '',
    'Borrower Name':       l.borrower_name || '',
    'Mobile':              l.customer_mobile || '',
    'Branch':              l.branch || '',
    'Cluster':             l.cluster || '',
    'Zone':                l.zone || '',
    'SO / Officer':        l.so_name || '',
    'Principal (₹)':       l.principal || 0,
    'Rate (%)':            l.rate || 0,
    'Charges (₹)':         l.charges || 0,
    'GST (₹)':             l.gst || 0,
    'Outstanding (₹)':     l.outstanding || 0,
    'Status':              formatStatus(l.status),
    'Closure Date':        l.closure_date || '',
    'Bank Name':           l.bank_name || '',
    'Account Number':      l.account_number || '',
    'IFSC Code':           l.ifsc_code || '',
    'Net Weight (g)':      l.net_weight || 0,
    'Value Pledged (₹)':   l.value_pledged || 0,
    'Purpose':             l.purpose || '',
    'Approved by Cluster': l.approved_by_cluster || '',
    'Approved by Zonal':   l.approved_by_zonal || '',
    'Submitted By':        l.submitted_by || '',
  }));
}

function buildCollectionRows(collections) {
  return collections.map(c => ({
    'Loan Number':         c.loan_number || '',
    'Borrower Name':       c.borrower_name || '',
    'Branch':              c.branch || '',
    'Cluster':             c.cluster || '',
    'Collection Date':     c.credit_note_date || '',
    'Amount Collected (₹)':  c.amount_collected || 0,
    'Principal Component': c.principal_component || 0,
    'Charges Component':   c.charges_component || 0,
    'GST Component':       c.gst_component || 0,
    'Credit Note / UTR':   c.credit_note_number || '',
    'Bank Name':           c.bank_name || '',
    'Payment Mode':        c.payment_mode ? c.payment_mode.replace(/_/g, ' ') : '',
    'Loan Closed':         c.close_loan ? 'Yes' : 'No',
    'Notes':               c.notes || '',
    'Recorded By':         c.recorded_by || '',
  }));
}

export default function ExportPanel() {
  const [loading, setLoading] = useState(null);

  async function fetchData() {
    const [loans, collections] = await Promise.all([
      base44.entities.Loan.list(),
      base44.entities.Collection.list(),
    ]);
    return { loans, collections };
  }

  async function downloadExcel() {
    setLoading('excel');
    const { loans, collections } = await fetchData();

    const wb = XLSX.utils.book_new();

    const loanSheet = XLSX.utils.json_to_sheet(buildLoanRows(loans));
    XLSX.utils.book_append_sheet(wb, loanSheet, 'Loans');

    const colSheet = XLSX.utils.json_to_sheet(buildCollectionRows(collections));
    XLSX.utils.book_append_sheet(wb, colSheet, 'Collections');

    XLSX.writeFile(wb, `BridgeLine-Export-${format(new Date(), 'yyyyMMdd')}.xlsx`);
    setLoading(null);
  }

  async function downloadPDF() {
    setLoading('pdf');
    const { loans, collections } = await fetchData();

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const margin = 10;
    const NAVY = [26, 39, 68];
    const GOLD = [201, 168, 76];
    const today = format(new Date(), 'dd-MMM-yyyy');

    function header(title) {
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('BridgeLine Partners', margin, 9);
      doc.setTextColor(...GOLD);
      doc.setFontSize(9);
      doc.text(title, W / 2, 9, { align: 'center' });
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`As of ${today}`, W - margin, 9, { align: 'right' });
    }

    function drawTable(rows, cols, startY) {
      if (!rows.length) return startY;
      const colW = (W - margin * 2) / cols.length;
      let y = startY;

      // Table header
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, W - margin * 2, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      cols.forEach((col, i) => {
        doc.text(String(col), margin + i * colW + 1, y + 4.2, { maxWidth: colW - 2 });
      });
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      rows.forEach((row, ri) => {
        if (y > pageH - 15) {
          doc.addPage();
          header('');
          y = 20;
        }
        if (ri % 2 === 0) {
          doc.setFillColor(245, 247, 252);
          doc.rect(margin, y - 3, W - margin * 2, 5.5, 'F');
        }
        doc.setTextColor(30, 30, 50);
        cols.forEach((col, i) => {
          const val = row[col] != null ? String(row[col]) : '';
          doc.text(val, margin + i * colW + 1, y, { maxWidth: colW - 2 });
        });
        doc.setDrawColor(220, 225, 235);
        doc.line(margin, y + 2, W - margin, y + 2);
        y += 5.5;
      });
      return y;
    }

    // ── Sheet 1: Loans ─────────────────────────────────────
    header('LOANS REGISTER');
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('LOANS REGISTER', margin, 22);

    const loanCols = ['Disbursal ID', 'Loan Number', 'Disbursement Date', 'Borrower Name', 'Branch', 'Cluster', 'Principal (₹)', 'Charges (₹)', 'GST (₹)', 'Outstanding (₹)', 'Status', 'Closure Date'];
    const loanRows = buildLoanRows(loans);
    drawTable(loanRows, loanCols, 26);

    // ── Sheet 2: Collections ───────────────────────────────
    doc.addPage();
    header('COLLECTIONS REGISTER');
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('COLLECTIONS REGISTER', margin, 22);

    const colCols = ['Loan Number', 'Borrower Name', 'Branch', 'Cluster', 'Collection Date', 'Amount Collected (₹)', 'Credit Note / UTR', 'Payment Mode', 'Loan Closed'];
    const colRows = buildCollectionRows(collections);
    drawTable(colRows, colCols, 26);

    doc.save(`BridgeLine-Export-${format(new Date(), 'yyyyMMdd')}.pdf`);
    setLoading(null);
  }

  return (
    <div className="p-5">
      <div className="mb-4">
        <h3 className="font-syne font-bold text-sm">Full Data Export</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Export all loans + collections in one file — choose your format below.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Excel */}
        <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={22} className="text-green-600 shrink-0" />
            <div>
              <div className="font-semibold text-sm">Excel Export (.xlsx)</div>
              <div className="text-xs text-muted-foreground mt-0.5">Two sheets: Loans + Collections, all fields</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={downloadExcel} disabled={!!loading}>
            {loading === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading === 'excel' ? 'Generating...' : 'Download Excel'}
          </Button>
        </div>

        {/* PDF */}
        <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText size={22} className="text-red-500 shrink-0" />
            <div>
              <div className="font-semibold text-sm">PDF Export (.pdf)</div>
              <div className="text-xs text-muted-foreground mt-0.5">Two pages: Loans + Collections on BridgeLine letterhead</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={downloadPDF} disabled={!!loading}>
            {loading === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading === 'pdf' ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
}