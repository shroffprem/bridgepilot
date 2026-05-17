import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Loader2, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

// ── helpers ──────────────────────────────────────────────────
function fmtStatus(s) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
}
function fmtINR(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString('en-IN');
}

function loanRows(loans) {
  return loans.map(l => ({
    'Company':           l.company || '',
    'Disbursal ID':      l.disbursal_id || '',
    'Loan #':            l.loan_number || '',
    'Date':              l.disbursement_date || '',
    'Borrower':          l.borrower_name || '',
    'Mobile':            l.customer_mobile || '',
    'Branch':            l.branch || '',
    'Cluster':           l.cluster || '',
    'SO':                l.so_name || '',
    'Principal (₹)':     l.principal || 0,
    'Rate (%)':          l.rate || 0,
    'Charges (₹)':       l.charges || 0,
    'GST (₹)':           l.gst || 0,
    'Outstanding (₹)':   l.outstanding || 0,
    'Status':            fmtStatus(l.status),
    'Closure Date':      l.closure_date || '',
    'UTR / Ref':         l.disbursal_utr || '',
    'Amount (₹)':        l.principal || 0,
  }));
}

function collRows(cols) {
  return cols.map(c => ({
    'Loan #':              c.loan_number || '',
    'Borrower':            c.borrower_name || '',
    'Branch':              c.branch || '',
    'Cluster':             c.cluster || '',
    'Date':                c.credit_note_date || '',
    'Amount Collected (₹)': c.amount_collected || 0,
    'Principal (₹)':       c.principal_component || 0,
    'Charges (₹)':         c.charges_component || 0,
    'GST (₹)':             c.gst_component || 0,
    'Penalty (₹)':         c.penalty_component || 0,
    'Bank':                c.bank_name || '',
    'Payment Mode':        c.payment_mode ? c.payment_mode.replace(/_/g, ' ') : '',
    'UTR / Ref':           c.credit_note_number || '',
    'Closure Date':        c.closure_date || '',
    'Loan Closed':         c.close_loan ? 'Yes' : 'No',
    'Notes':               c.notes || '',
  }));
}

// date filter
function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
  return isWithinInterval(d, { start: from, end: to });
}

// ── date preset helpers ───────────────────────────────────────
function getPresetRange(preset) {
  const today = new Date();
  if (preset === 'current') return { from: startOfMonth(today), to: endOfMonth(today) };
  if (preset === 'previous') {
    const prev = subMonths(today, 1);
    return { from: startOfMonth(prev), to: endOfMonth(prev) };
  }
  return null; // custom / all
}

const NAVY = [26, 39, 68];
const GOLD = [201, 168, 76];

// ── PDF generation ────────────────────────────────────────────
async function buildPDF(loans, collections, filterLabel) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const M = 12;
  const contentW = W - M * 2;
  const today = format(new Date(), 'dd-MMM-yyyy');

  function drawHeader(sectionTitle) {
    // Navy banner
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 18, 'F');
    // Gold accent line
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, 18.5, W - M, 18.5);
    doc.setLineWidth(0.2);

    // Company name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('BridgeLine', M, 11);
    const bW = doc.getTextWidth('BridgeLine');
    doc.setTextColor(...GOLD);
    doc.text('Partners', M + bW + 1, 11);

    // Section title (center)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(sectionTitle, W / 2, 11, { align: 'center' });

    // Right: date + filter
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(200, 200, 210);
    doc.text(`${filterLabel}  |  Generated: ${today}`, W - M, 11, { align: 'right' });
  }

  // Column definitions with explicit widths (landscape A4 = 297mm, content = 273mm)
  const LOAN_DEFS = [
    { key: 'Company',         w: 26 },
    { key: 'Disbursal ID',    w: 24 },
    { key: 'Date',            w: 20 },
    { key: 'Borrower',        w: 38 },
    { key: 'Branch',          w: 24 },
    { key: 'Cluster',         w: 22 },
    { key: 'Principal (₹)',   w: 22, right: true },
    { key: 'Charges (₹)',     w: 20, right: true },
    { key: 'GST (₹)',         w: 16, right: true },
    { key: 'Outstanding (₹)', w: 24, right: true },
    { key: 'Status',          w: 22 },
    { key: 'UTR / Ref',       w: 37 },
  ];

  const COL_DEFS = [
    { key: 'Loan #',               w: 22 },
    { key: 'Borrower',             w: 36 },
    { key: 'Branch',               w: 22 },
    { key: 'Cluster',              w: 20 },
    { key: 'Date',                 w: 18 },
    { key: 'Amount Collected (₹)', w: 24, right: true },
    { key: 'Principal (₹)',        w: 18, right: true },
    { key: 'Charges (₹)',          w: 16, right: true },
    { key: 'GST (₹)',              w: 13, right: true },
    { key: 'Penalty (₹)',          w: 14, right: true },
    { key: 'Payment Mode',         w: 20 },
    { key: 'UTR / Ref',            w: 38 },
    { key: 'Loan Closed',          w: 14 },
  ];

  function drawTable(rows, defs, startY) {
    const totalW = defs.reduce((s, d) => s + d.w, 0);
    const scale = contentW / totalW; // scale widths to fit exactly
    const scaledDefs = defs.map(d => ({ ...d, w: d.w * scale }));

    let y = startY;
    const ROW_H = 6;
    const HEAD_H = 7;

    function tableHeader(yy) {
      doc.setFillColor(...NAVY);
      doc.rect(M, yy, contentW, HEAD_H, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      let x = M;
      scaledDefs.forEach(d => {
        const tx = d.right ? x + d.w - 1.5 : x + 1.5;
        doc.text(d.key, tx, yy + 4.8, { align: d.right ? 'right' : 'left', maxWidth: d.w - 2 });
        x += d.w;
      });
      return yy + HEAD_H + 1;
    }

    y = tableHeader(y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);

    rows.forEach((row, ri) => {
      if (y + ROW_H > pageH - 12) {
        doc.addPage();
        drawHeader('');
        y = tableHeader(22);
      }
      if (ri % 2 === 0) {
        doc.setFillColor(244, 246, 252);
        doc.rect(M, y - 1, contentW, ROW_H, 'F');
      }
      doc.setTextColor(25, 30, 55);
      let x = M;
      scaledDefs.forEach(d => {
        const val = row[d.key] != null ? String(row[d.key]) : '';
        const tx = d.right ? x + d.w - 1.5 : x + 1.5;
        // truncate long values
        const maxChars = Math.floor(d.w / 1.6);
        const display = val.length > maxChars ? val.slice(0, maxChars - 1) + '…' : val;
        doc.text(display, tx, y + 3.8, { align: d.right ? 'right' : 'left' });
        x += d.w;
      });
      doc.setDrawColor(215, 220, 235);
      doc.setLineWidth(0.15);
      doc.line(M, y + ROW_H - 0.5, M + contentW, y + ROW_H - 0.5);
      y += ROW_H;
    });

    return y;
  }

  function drawSummaryBar(count, sumLabel, sum, y) {
    doc.setFillColor(235, 238, 248);
    doc.rect(M, y + 2, contentW, 8, 'F');
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.rect(M, y + 2, contentW, 8, 'S');
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...NAVY);
    doc.text(`Total: ${count} records   |   ${sumLabel}: ₹${fmtINR(sum)}`, M + 3, y + 7.5);
    return y + 14;
  }

  // ── PAGE 1: Loans ─────────────────────────────────────────
  drawHeader('LOANS REGISTER');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('LOANS REGISTER', M, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 110, 130);
  doc.text(`${loans.length} records`, M + doc.getTextWidth('LOANS REGISTER') + 4, 27);

  const lRows = loanRows(loans);
  let y = drawTable(lRows, LOAN_DEFS, 31);
  const loanTotal = loans.reduce((s, l) => s + (l.principal || 0), 0);
  drawSummaryBar(loans.length, 'Total Principal', loanTotal, y);

  // ── PAGE 2: Collections ───────────────────────────────────
  doc.addPage();
  drawHeader('COLLECTIONS REGISTER');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('COLLECTIONS REGISTER', M, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 110, 130);
  doc.text(`${collections.length} records`, M + doc.getTextWidth('COLLECTIONS REGISTER') + 4, 27);

  const cRows = collRows(collections);
  y = drawTable(cRows, COL_DEFS, 31);
  const collTotal = collections.reduce((s, c) => s + (c.amount_collected || 0), 0);
  const penaltyTotal = collections.reduce((s, c) => s + (c.penalty_component || 0), 0);
  drawSummaryBar(collections.length, `Total Collected${penaltyTotal > 0 ? ` (incl. ₹${fmtINR(penaltyTotal)} penalty)` : ''}`, collTotal, y);

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(150, 155, 170);
    doc.text(`Page ${i} of ${totalPages}  |  Confidential — BridgeLine Partners`, W / 2, pageH - 5, { align: 'center' });
  }

  return doc;
}

const COMPANIES = ['HDB Financials', 'ICICI Bank'];

// ── Component ─────────────────────────────────────────────────
export default function ExportPanel() {
  const [allLoans, setAllLoans] = useState([]);
  const [allCols, setAllCols] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [fetched, setFetched] = useState(false);
  const [loading, setLoading] = useState(null);

  // Filters
  const [company, setCompany] = useState('all');
  const [cluster, setCluster] = useState('all');
  const [datePreset, setDatePreset] = useState('current'); // current | previous | custom | all
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    Promise.all([
      base44.entities.Loan.list(),
      base44.entities.Collection.list(),
    ]).then(([l, c]) => {
      setAllLoans(l);
      setAllCols(c);
      const clusterSet = [...new Set(l.map(x => x.cluster).filter(Boolean))].sort();
      setClusters(clusterSet);
      setFetched(true);
    });
  }, []);

  function applyFilters(loans, cols) {
    let from = null, to = null;
    const preset = getPresetRange(datePreset);
    if (preset) { from = preset.from; to = preset.to; }
    else if (datePreset === 'custom' && customFrom && customTo) {
      from = parseISO(customFrom);
      to = parseISO(customTo);
    }

    let filteredLoans = loans;
    let filteredCols = cols;

    if (company !== 'all') {
      filteredLoans = filteredLoans.filter(l => l.company === company);
      // collections don't have company directly — filter via loan_number cross-reference
      const matchedNumbers = new Set(filteredLoans.map(l => l.loan_number));
      filteredCols = filteredCols.filter(c => matchedNumbers.has(c.loan_number));
    }

    if (cluster !== 'all') {
      filteredLoans = filteredLoans.filter(l => l.cluster === cluster);
      filteredCols = filteredCols.filter(c => c.cluster === cluster);
    }

    if (from && to) {
      filteredLoans = filteredLoans.filter(l => inRange(l.disbursement_date, from, to));
      filteredCols = filteredCols.filter(c => inRange(c.credit_note_date, from, to));
    }

    return { filteredLoans, filteredCols };
  }

  function filterLabel() {
    const co = company === 'all' ? 'All Companies' : company;
    const cl = cluster === 'all' ? `${co}` : `${co} · ${cluster}`;
    let dt = '';
    if (datePreset === 'current') dt = format(new Date(), 'MMM yyyy');
    else if (datePreset === 'previous') dt = format(subMonths(new Date(), 1), 'MMM yyyy');
    else if (datePreset === 'all') dt = 'All Time';
    else if (datePreset === 'custom' && customFrom && customTo) dt = `${customFrom} to ${customTo}`;
    else dt = 'Custom';
    return `${cl}  ·  ${dt}`;
  }

  async function downloadExcel() {
    setLoading('excel');
    const { filteredLoans, filteredCols } = applyFilters(allLoans, allCols);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loanRows(filteredLoans)), 'Loans');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(collRows(filteredCols)), 'Collections');
    XLSX.writeFile(wb, `BridgeLine-Export-${format(new Date(), 'yyyyMMdd')}.xlsx`);
    setLoading(null);
  }

  async function downloadPDF() {
    setLoading('pdf');
    const { filteredLoans, filteredCols } = applyFilters(allLoans, allCols);
    const doc = await buildPDF(filteredLoans, filteredCols, filterLabel());
    doc.save(`BridgeLine-Export-${format(new Date(), 'yyyyMMdd')}.pdf`);
    setLoading(null);
  }

  const selectCls = "text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="p-5 space-y-5">
      {/* ── Filters ── */}
      <div className="bg-muted/40 rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter Export</span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Company */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Company</label>
            <select className={selectCls} value={company} onChange={e => setCompany(e.target.value)}>
              <option value="all">All Companies</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Cluster */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Cluster</label>
            <select className={selectCls} value={cluster} onChange={e => setCluster(e.target.value)}>
              <option value="all">All Clusters</option>
              {clusters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Date preset */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Period</label>
            <select className={selectCls} value={datePreset} onChange={e => setDatePreset(e.target.value)}>
              <option value="current">Current Month ({format(new Date(), 'MMM yyyy')})</option>
              <option value="previous">Previous Month ({format(subMonths(new Date(), 1), 'MMM yyyy')})</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom range */}
          {datePreset === 'custom' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">From</label>
                <input type="date" className={selectCls} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">To</label>
                <input type="date" className={selectCls} value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {fetched && (
          <div className="mt-3 text-xs text-muted-foreground">
            {(() => {
              const { filteredLoans, filteredCols } = applyFilters(allLoans, allCols);
              return `${filteredLoans.length} loans · ${filteredCols.length} collections matched`;
            })()}
          </div>
        )}
      </div>

      {/* ── Download buttons ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={22} className="text-green-600 shrink-0" />
            <div>
              <div className="font-semibold text-sm">Excel (.xlsx)</div>
              <div className="text-xs text-muted-foreground mt-0.5">Loans + Collections sheets</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={downloadExcel} disabled={!!loading || !fetched}>
            {loading === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading === 'excel' ? 'Generating...' : 'Download'}
          </Button>
        </div>

        <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText size={22} className="text-red-500 shrink-0" />
            <div>
              <div className="font-semibold text-sm">PDF (.pdf)</div>
              <div className="text-xs text-muted-foreground mt-0.5">Branded landscape register</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={downloadPDF} disabled={!!loading || !fetched}>
            {loading === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading === 'pdf' ? 'Generating...' : 'Download'}
          </Button>
        </div>
      </div>


    </div>
  );
}