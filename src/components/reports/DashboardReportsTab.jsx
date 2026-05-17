import { useState } from 'react';
import { format, startOfMonth, startOfYear, parseISO,
  subMonths, endOfMonth, startOfQuarter, endOfDay, startOfDay } from 'date-fns';
import { Loader2, Download, FileSpreadsheet, FileText, CalendarRange, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';

const NAVY = [26, 39, 68];
const GOLD = [201, 168, 76];

function fmtINR(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString('en-IN');
}

function makePresets() {
  const now = new Date();
  return [
    { label: 'Today',        from: startOfDay(now),                 to: endOfDay(now) },
    { label: 'This Month',   from: startOfMonth(now),               to: now },
    { label: 'Last Month',   from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
    { label: 'This Quarter', from: startOfQuarter(now),             to: now },
    { label: 'This Year',    from: startOfYear(now),                to: now },
  ];
}

function PresetBar({ preset, setPreset, from, setFrom, to, setTo }) {
  const PRESETS = makePresets();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => {
            setPreset(p.label);
            setFrom(format(p.from, 'yyyy-MM-dd'));
            setTo(format(p.to, 'yyyy-MM-dd'));
          }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              preset === p.label
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            }`}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setPreset('Custom')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            preset === 'Custom'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
          }`}>
          Custom
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('Custom'); }} className="h-8 text-xs w-36" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('Custom'); }} className="h-8 text-xs w-36" />
      </div>
    </div>
  );
}

async function buildPDF({ title, subtitle, rows, colDefs, summaryLine }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const M = 12;
  const contentW = W - M * 2;
  const today = format(new Date(), 'dd-MMM-yyyy');

  function drawHeader() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 18, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, 18.5, W - M, 18.5);
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('BridgeLine', M, 11);
    const bW = doc.getTextWidth('BridgeLine');
    doc.setTextColor(...GOLD);
    doc.text('Partners', M + bW + 1, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), W / 2, 11, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(200, 200, 210);
    doc.text(`Generated: ${today}`, W - M, 11, { align: 'right' });
  }

  const totalW = colDefs.reduce((s, d) => s + d.w, 0);
  const scale = contentW / totalW;
  const sDefs = colDefs.map(d => ({ ...d, w: d.w * scale }));

  drawHeader();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(subtitle, M, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 110, 130);
  doc.text(`${rows.length} records`, M + doc.getTextWidth(subtitle) + 4, 27);

  const ROW_H = 6, HEAD_H = 7;
  let y = 31;

  function tableHeader(yy) {
    doc.setFillColor(...NAVY);
    doc.rect(M, yy, contentW, HEAD_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    let x = M;
    sDefs.forEach(d => {
      doc.text(d.key, d.right ? x + d.w - 1.5 : x + 1.5, yy + 4.8, { align: d.right ? 'right' : 'left', maxWidth: d.w - 2 });
      x += d.w;
    });
    return yy + HEAD_H + 1;
  }

  y = tableHeader(y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);

  rows.forEach((row, ri) => {
    if (y + ROW_H > pageH - 14) {
      doc.addPage();
      drawHeader();
      y = tableHeader(22);
    }
    if (ri % 2 === 0) {
      doc.setFillColor(244, 246, 252);
      doc.rect(M, y - 1, contentW, ROW_H, 'F');
    }
    doc.setTextColor(25, 30, 55);
    let x = M;
    sDefs.forEach(d => {
      const val = row[d.key] != null ? String(row[d.key]) : '';
      const maxChars = Math.floor(d.w / 1.55);
      const display = val.length > maxChars ? val.slice(0, maxChars - 1) + '…' : val;
      const color = d.colorFn ? d.colorFn(row[d.key]) : null;
      if (color) doc.setTextColor(...color); else doc.setTextColor(25, 30, 55);
      doc.text(display, d.right ? x + d.w - 1.5 : x + 1.5, y + 3.8, { align: d.right ? 'right' : 'left' });
      x += d.w;
    });
    doc.setDrawColor(215, 220, 235);
    doc.setLineWidth(0.15);
    doc.line(M, y + ROW_H - 0.5, M + contentW, y + ROW_H - 0.5);
    y += ROW_H;
  });

  // Summary bar
  if (summaryLine) {
    doc.setFillColor(235, 238, 248);
    doc.rect(M, y + 2, contentW, 8, 'F');
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.rect(M, y + 2, contentW, 8, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...NAVY);
    doc.text(summaryLine, M + 3, y + 7.5);
  }

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

export default function DashboardReportsTab({ loans, collections, disbursals, downloading, setDownloading, downloadDashboardReport }) {
  const now = new Date();

  // Collection report state
  const [collPreset, setCollPreset] = useState('This Month');
  const [collFrom, setCollFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [collTo, setCollTo] = useState(format(now, 'yyyy-MM-dd'));

  // Reconciliation report state
  const [recoPreset, setRecoPreset] = useState('This Month');
  const [recoFrom, setRecoFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [recoTo, setRecoTo] = useState(format(now, 'yyyy-MM-dd'));

  // ── Collection download ──────────────────────────────────────────
  const downloadCollectionReport = async (fileType) => {
    const key = `collection_${fileType}`;
    setDownloading(key);
    try {
      const from = parseISO(collFrom);
      const to   = parseISO(collTo);
      const label = collPreset === 'Custom' ? `${collFrom} to ${collTo}` : collPreset;
      const filtered = collections.filter(c => {
        if (!c.credit_note_date) return false;
        const d = parseISO(c.credit_note_date);
        return d >= from && d <= to;
      });
      const rows = filtered.map(c => ({
        'Loan #':               c.loan_number || '',
        'Borrower':             c.borrower_name || '',
        'Branch':               c.branch || '',
        'Cluster':              c.cluster || '',
        'Collection Date':      c.credit_note_date || '',
        'Amount Collected (₹)': c.amount_collected || 0,
        'Principal (₹)':        c.principal_component || 0,
        'Charges (₹)':          c.charges_component || 0,
        'GST (₹)':              c.gst_component || 0,
        'Penalty (₹)':          c.penalty_component || 0,
        'Bank':                 c.bank_name || '',
        'Payment Mode':         (c.payment_mode || '').replace(/_/g, ' '),
        'Credit UTR / Ref':     c.credit_note_number || '',
        'Closure Date':         c.closure_date || '',
        'Loan Closed':          c.close_loan ? 'Yes' : 'No',
        'Notes':                c.notes || '',
      }));
      if (fileType === 'excel') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Collections');
        XLSX.writeFile(wb, `BridgeLine-Collections-${label.replace(/\s/g,'-')}-${format(now,'yyyyMMdd')}.xlsx`);
      } else {
        const colDefs = [
          { key: 'Loan #',               w: 20 },
          { key: 'Borrower',             w: 32 },
          { key: 'Branch',               w: 20 },
          { key: 'Cluster',              w: 18 },
          { key: 'Collection Date',      w: 18 },
          { key: 'Amount Collected (₹)', w: 22, right: true },
          { key: 'Principal (₹)',        w: 17, right: true },
          { key: 'Charges (₹)',          w: 15, right: true },
          { key: 'GST (₹)',              w: 12, right: true },
          { key: 'Penalty (₹)',          w: 13, right: true },
          { key: 'Payment Mode',         w: 18 },
          { key: 'Credit UTR / Ref',     w: 42 },
          { key: 'Loan Closed',          w: 13 },
        ];
        const totalAmt = rows.reduce((s, r) => s + (r['Amount Collected (₹)'] || 0), 0);
        const totalPenalty = rows.reduce((s, r) => s + (r['Penalty (₹)'] || 0), 0);
        const penStr = totalPenalty > 0 ? `   |   Penalty: ₹${fmtINR(totalPenalty)}` : '';
        const doc = await buildPDF({
          title: `Collections Report — ${label}`,
          subtitle: `Collections Register — ${label}`,
          rows, colDefs,
          summaryLine: `Total: ${rows.length} records   |   Amount Collected: ₹${fmtINR(totalAmt)}${penStr}`,
        });
        doc.save(`BridgeLine-Collections-${label.replace(/\s/g,'-')}-${format(now,'yyyyMMdd')}.pdf`);
      }
    } catch (err) { console.error(err); }
    setDownloading(null);
  };

  // ── Reconciliation download ──────────────────────────────────────
  const downloadRecoReport = async (fileType) => {
    const key = `reco_${fileType}`;
    setDownloading(key);
    try {
      const from  = parseISO(recoFrom);
      const to    = parseISO(recoTo);
      const label = recoPreset === 'Custom' ? `${recoFrom} to ${recoTo}` : recoPreset;

      // Build loan map
      const loanMap = {};
      loans.forEach(l => { loanMap[l.id] = l; });

      // Index disbursals by loan_id
      const disbMap = {};
      disbursals.forEach(d => {
        if (!disbMap[d.loan_id]) disbMap[d.loan_id] = [];
        disbMap[d.loan_id].push(d);
      });

      // Index collections by loan_id
      const collMap = {};
      collections.forEach(c => {
        if (!collMap[c.loan_id]) collMap[c.loan_id] = [];
        collMap[c.loan_id].push(c);
      });

      // Build per-loan reconciliation rows filtered by disbursal or collection date in range
      const allLoanIds = new Set([
        ...disbursals.filter(d => {
          if (!d.debit_note_date) return false;
          const dt = parseISO(d.debit_note_date);
          return dt >= from && dt <= to;
        }).map(d => d.loan_id),
        ...collections.filter(c => {
          if (!c.credit_note_date) return false;
          const dt = parseISO(c.credit_note_date);
          return dt >= from && dt <= to;
        }).map(c => c.loan_id),
      ]);

      const rows = [];
      allLoanIds.forEach(loanId => {
        const loan = loanMap[loanId] || {};
        const lDisbs = disbMap[loanId] || [];
        const lColls = collMap[loanId] || [];

        const totalDisbursed  = lDisbs.reduce((s, d) => s + (d.principal || 0), 0);
        const totalCollected  = lColls.reduce((s, c) => s + (c.amount_collected || 0), 0);
        const totalPrincipalC = lColls.reduce((s, c) => s + (c.principal_component || 0), 0);
        const totalChargesC   = lColls.reduce((s, c) => s + (c.charges_component || 0), 0);
        const totalGstC       = lColls.reduce((s, c) => s + (c.gst_component || 0), 0);
        const totalPenaltyC   = lColls.reduce((s, c) => s + (c.penalty_component || 0), 0);
        const outstanding     = loan.outstanding != null ? loan.outstanding : Math.max(0, totalDisbursed - totalCollected);

        const debitUTRs  = lDisbs.map(d => d.debit_note_number).filter(Boolean).join(', ');
        const creditUTRs = lColls.map(c => c.credit_note_number).filter(Boolean).join(', ');
        const disbDates  = lDisbs.map(d => d.debit_note_date).filter(Boolean).join(', ');
        const collDates  = lColls.map(c => c.credit_note_date).filter(Boolean).join(', ');
        const disbBanks  = [...new Set(lDisbs.map(d => d.bank_name).filter(Boolean))].join(', ');
        const collBanks  = [...new Set(lColls.map(c => c.bank_name).filter(Boolean))].join(', ');

        let status = 'Disbursed — Pending Collection';
        if (loan.status === 'closed') status = 'Fully Closed';
        else if (totalCollected > 0 && totalCollected < totalDisbursed) status = 'Partially Collected';
        else if (totalCollected >= totalDisbursed && totalDisbursed > 0) status = 'Fully Collected';

        rows.push({
          'Loan #':             loan.loan_number || '',
          'Borrower':           loan.borrower_name || '',
          'Branch':             loan.branch || '',
          'Cluster':            loan.cluster || '',
          'Status':             status,
          // Debit side
          'Disbursal Date(s)':  disbDates || '—',
          'Debit Bank':         disbBanks || '—',
          'Debit UTR(s)':       debitUTRs || '—',
          'Disbursed (₹)':      totalDisbursed,
          // Credit side
          'Collection Date(s)': collDates || '—',
          'Credit Bank':        collBanks || '—',
          'Credit UTR(s)':      creditUTRs || '—',
          'Collected (₹)':      totalCollected,
          'Principal Coll (₹)': totalPrincipalC,
          'Charges (₹)':        totalChargesC,
          'GST (₹)':            totalGstC,
          'Penalty (₹)':        totalPenaltyC,
          // Gap
          'Outstanding (₹)':    outstanding,
          'Loan Closed':        loan.status === 'closed' ? 'Yes' : 'No',
        });
      });

      // Sort: open/overdue first, then closed
      rows.sort((a, b) => {
        const order = { 'Disbursed — Pending Collection': 0, 'Partially Collected': 1, 'Fully Collected': 2, 'Fully Closed': 3 };
        return (order[a.Status] ?? 4) - (order[b.Status] ?? 4);
      });

      if (fileType === 'excel') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Reconciliation');
        XLSX.writeFile(wb, `BridgeLine-Reconciliation-${label.replace(/\s/g,'-')}-${format(now,'yyyyMMdd')}.xlsx`);
      } else {
        const statusColors = {
          'Fully Closed':          [22, 163, 74],
          'Fully Collected':       [22, 163, 74],
          'Partially Collected':   [234, 179, 8],
          'Disbursed — Pending Collection': [239, 68, 68],
        };
        const colDefs = [
          { key: 'Loan #',             w: 19 },
          { key: 'Borrower',           w: 28 },
          { key: 'Branch',             w: 18 },
          { key: 'Cluster',            w: 16 },
          { key: 'Status',             w: 28, colorFn: (v) => statusColors[v] || NAVY },
          { key: 'Disbursal Date(s)',  w: 18 },
          { key: 'Debit Bank',         w: 18 },
          { key: 'Debit UTR(s)',       w: 36 },
          { key: 'Disbursed (₹)',      w: 18, right: true },
          { key: 'Collection Date(s)', w: 18 },
          { key: 'Credit Bank',        w: 18 },
          { key: 'Credit UTR(s)',      w: 36 },
          { key: 'Collected (₹)',      w: 18, right: true },
          { key: 'Charges (₹)',        w: 14, right: true },
          { key: 'GST (₹)',            w: 11, right: true },
          { key: 'Penalty (₹)',        w: 13, right: true },
          { key: 'Outstanding (₹)',    w: 18, right: true },
          { key: 'Loan Closed',        w: 13 },
        ];
        const totalDisb = rows.reduce((s, r) => s + (r['Disbursed (₹)'] || 0), 0);
        const totalColl = rows.reduce((s, r) => s + (r['Collected (₹)'] || 0), 0);
        const totalOut  = rows.reduce((s, r) => s + (r['Outstanding (₹)'] || 0), 0);
        const closedCt  = rows.filter(r => r['Loan Closed'] === 'Yes').length;
        const doc = await buildPDF({
          title: `Reconciliation Report — ${label}`,
          subtitle: `Disbursal ↔ Collection Reconciliation — ${label}`,
          rows, colDefs,
          summaryLine: `${rows.length} loans   |   Disbursed: ₹${fmtINR(totalDisb)}   |   Collected: ₹${fmtINR(totalColl)}   |   Outstanding: ₹${fmtINR(totalOut)}   |   Closed: ${closedCt}`,
        });
        doc.save(`BridgeLine-Reconciliation-${label.replace(/\s/g,'-')}-${format(now,'yyyyMMdd')}.pdf`);
      }
    } catch (err) { console.error(err); }
    setDownloading(null);
  };

  const collCount = collections.filter(c => {
    if (!c.credit_note_date) return false;
    const d = parseISO(c.credit_note_date);
    return d >= parseISO(collFrom) && d <= parseISO(collTo);
  }).length;

  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="font-syne font-bold text-sm">Dashboard Performance Reports</h3>
        <p className="text-xs text-muted-foreground mt-1">Portfolio overview on BridgeLine letterhead</p>
      </div>

      {/* MTD / YTD Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm">MTD Report</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(), 'MMMM yyyy')} — month-wise breakdown, goalpost & cluster analytics
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 shrink-0"
            onClick={() => downloadDashboardReport('mtd')} disabled={!!downloading}>
            {downloading === 'dashboard_mtd' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading === 'dashboard_mtd' ? 'Generating...' : 'Download MTD'}
          </Button>
        </div>
        <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm">YTD Report</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {new Date().getFullYear()} — all months breakdown & cluster analytics
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 shrink-0"
            onClick={() => downloadDashboardReport('ytd')} disabled={!!downloading}>
            {downloading === 'dashboard_ytd' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading === 'dashboard_ytd' ? 'Generating...' : 'Download YTD'}
          </Button>
        </div>
      </div>

      {/* Collection Report */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="text-primary" />
          <h4 className="font-syne font-bold text-sm">Collection Report</h4>
          <span className="text-xs text-muted-foreground">— principal, charges, GST, penalty, UTR</span>
          <span className="ml-auto text-xs text-muted-foreground">{collCount} records</span>
        </div>
        <PresetBar preset={collPreset} setPreset={setCollPreset} from={collFrom} setFrom={setCollFrom} to={collTo} setTo={setCollTo} />
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="gap-1.5"
            onClick={() => downloadCollectionReport('excel')} disabled={!!downloading}>
            {downloading === 'collection_excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} className="text-green-600" />}
            {downloading === 'collection_excel' ? 'Generating...' : 'Download Excel'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5"
            onClick={() => downloadCollectionReport('pdf')} disabled={!!downloading}>
            {downloading === 'collection_pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-red-500" />}
            {downloading === 'collection_pdf' ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Reconciliation Report */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitMerge size={15} className="text-purple-600" />
          <h4 className="font-syne font-bold text-sm">Reconciliation Report</h4>
          <span className="text-xs text-muted-foreground">— disbursal ↔ collection audit trail for accountant</span>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          One row per loan — Debit UTR (outgoing) matched against Credit UTR (incoming), with full financial breakdown and status.
        </p>
        <PresetBar preset={recoPreset} setPreset={setRecoPreset} from={recoFrom} setFrom={setRecoFrom} to={recoTo} setTo={setRecoTo} />
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="gap-1.5"
            onClick={() => downloadRecoReport('excel')} disabled={!!downloading}>
            {downloading === 'reco_excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} className="text-green-600" />}
            {downloading === 'reco_excel' ? 'Generating...' : 'Download Excel'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5"
            onClick={() => downloadRecoReport('pdf')} disabled={!!downloading}>
            {downloading === 'reco_pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-red-500" />}
            {downloading === 'reco_pdf' ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
}