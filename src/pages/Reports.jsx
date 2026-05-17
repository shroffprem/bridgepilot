import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, differenceInDays, startOfMonth, startOfYear, parseISO, isWithinInterval } from 'date-fns';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';
import { IndianRupee, TrendingUp, Users, AlertTriangle, CreditCard, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExportPanel from '@/components/reports/ExportPanel';
import * as XLSX from 'xlsx';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function formatINRExact(n) {
  if (!n) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function StatCard({ title, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   val: 'text-blue-700' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  val: 'text-green-700' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    val: 'text-red-700' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', val: 'text-yellow-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', val: 'text-purple-700' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="bg-card rounded-xl border border-border p-5 flex gap-4 items-start">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
        <Icon size={18} className={c.icon} />
      </div>
      <div>
        <div className="text-xs text-muted-foreground font-medium">{title}</div>
        <div className={`text-2xl font-bold font-syne mt-0.5 ${c.val}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="font-syne font-bold text-base text-foreground">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Reports() {
  const [loans, setLoans] = useState([]);
  const [collections, setCollections] = useState([]);
  const [disbursals, setDisbursals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [activeTab, setActiveTab] = useState('mis');

  useEffect(() => {
    Promise.all([
      base44.entities.Loan.list(),
      base44.entities.Collection.list(),
      base44.entities.Disbursal.list(),
    ]).then(([l, c, d]) => {
      setLoans(l);
      setCollections(c);
      setDisbursals(d);
      setLoading(false);
    });
  }, []);

  const downloadReport = async (reportType) => {
    setDownloading(reportType);
    try {
      const res = await base44.functions.invoke('generateConsolidatedMIS', {});
      if (res && res.data) {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `BridgeLine-MIS-${format(new Date(), 'yyyyMMdd')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
    setDownloading(null);
  };

  const downloadDashboardReport = async (period) => {
    const key = `dashboard_${period}`;
    setDownloading(key);
    try {
      const res = await base44.functions.invoke('generateDashboardReportPDF', { reportType: period });
      if (res && res.data) {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `BridgeLine-Dashboard-${period.toUpperCase()}-${format(new Date(), 'yyyyMMdd')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
    setDownloading(null);
  };

  const downloadCollectionReport = async (period, fileType) => {
    const key = `collection_${period}_${fileType}`;
    setDownloading(key);
    try {
      const now = new Date();
      const from = period === 'mtd' ? startOfMonth(now) : startOfYear(now);
      const filtered = collections.filter(c => {
        if (!c.credit_note_date) return false;
        return isWithinInterval(parseISO(c.credit_note_date), { start: from, end: now });
      });

      const rows = filtered.map(c => ({
        'Loan #':               c.loan_number || '',
        'Borrower':             c.borrower_name || '',
        'Branch':               c.branch || '',
        'Cluster':              c.cluster || '',
        'Date':                 c.credit_note_date || '',
        'Amount Collected (₹)': c.amount_collected || 0,
        'Principal (₹)':        c.principal_component || 0,
        'Charges (₹)':          c.charges_component || 0,
        'GST (₹)':              c.gst_component || 0,
        'Penalty (₹)':          c.penalty_component || 0,
        'Bank':                 c.bank_name || '',
        'Payment Mode':         (c.payment_mode || '').replace(/_/g, ' '),
        'UTR / Ref':            c.credit_note_number || '',
        'Closure Date':         c.closure_date || '',
        'Loan Closed':          c.close_loan ? 'Yes' : 'No',
        'Notes':                c.notes || '',
      }));

      if (fileType === 'excel') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Collections');
        XLSX.writeFile(wb, `BridgeLine-Collections-${period.toUpperCase()}-${format(now, 'yyyyMMdd')}.xlsx`);
      } else {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.width;
        const pageH = doc.internal.pageSize.height;
        const M = 12;
        const contentW = W - M * 2;
        const NAVY = [26, 39, 68];
        const GOLD = [201, 168, 76];
        const label = period === 'mtd' ? format(now, 'MMMM yyyy') : `YTD ${now.getFullYear()}`;
        const today = format(now, 'dd-MMM-yyyy');

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
          doc.text(`COLLECTIONS REPORT — ${label.toUpperCase()}`, W / 2, 11, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(200, 200, 210);
          doc.text(`Generated: ${today}`, W - M, 11, { align: 'right' });
        }

        const DEFS = [
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
        const totalW = DEFS.reduce((s, d) => s + d.w, 0);
        const scale = contentW / totalW;
        const sDefs = DEFS.map(d => ({ ...d, w: d.w * scale }));

        drawHeader();

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...NAVY);
        doc.text(`Collections Register — ${label}`, M, 27);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 110, 130);
        doc.text(`${rows.length} records`, M + doc.getTextWidth(`Collections Register — ${label}`) + 4, 27);

        let y = 31;
        const ROW_H = 6, HEAD_H = 7;

        function tableHeader(yy) {
          doc.setFillColor(...NAVY);
          doc.rect(M, yy, contentW, HEAD_H, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          let x = M;
          sDefs.forEach(d => {
            doc.text(d.key, d.right ? x + d.w - 1.5 : x + 1.5, yy + 4.8, { align: d.right ? 'right' : 'left', maxWidth: d.w - 2 });
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
            const maxChars = Math.floor(d.w / 1.6);
            const display = val.length > maxChars ? val.slice(0, maxChars - 1) + '…' : val;
            doc.text(display, d.right ? x + d.w - 1.5 : x + 1.5, y + 3.8, { align: d.right ? 'right' : 'left' });
            x += d.w;
          });
          doc.setDrawColor(215, 220, 235);
          doc.setLineWidth(0.15);
          doc.line(M, y + ROW_H - 0.5, M + contentW, y + ROW_H - 0.5);
          y += ROW_H;
        });

        // Summary bar
        const totalAmt = rows.reduce((s, r) => s + (r['Amount Collected (₹)'] || 0), 0);
        const totalPenalty = rows.reduce((s, r) => s + (r['Penalty (₹)'] || 0), 0);
        doc.setFillColor(235, 238, 248);
        doc.rect(M, y + 2, contentW, 8, 'F');
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.3);
        doc.rect(M, y + 2, contentW, 8, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...NAVY);
        const penStr = totalPenalty > 0 ? `   |   Penalty: ₹${Math.round(totalPenalty).toLocaleString('en-IN')}` : '';
        doc.text(`Total: ${rows.length} records   |   Amount Collected: ₹${Math.round(totalAmt).toLocaleString('en-IN')}${penStr}`, M + 3, y + 7.5);

        // Page numbers
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(150, 155, 170);
          doc.text(`Page ${i} of ${totalPages}  |  Confidential — BridgeLine Partners`, W / 2, pageH - 5, { align: 'center' });
        }

        doc.save(`BridgeLine-Collections-${period.toUpperCase()}-${format(now, 'yyyyMMdd')}.pdf`);
      }
    } catch (err) {
      console.error('Collection report failed:', err);
    }
    setDownloading(null);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  // ── Portfolio KPIs ──────────────────────────────────────────────
  const active      = loans.filter(l => l.status === 'open');
  const overdue     = loans.filter(l => l.status === 'overdue');
  const closed      = loans.filter(l => l.status === 'closed');
  const pending     = loans.filter(l => ['pending_cluster_approval','pending_zonal_approval'].includes(l.status));

  const totalDisbursed   = active.reduce((s, l) => s + (l.principal || 0), 0);
  const totalOverdue     = overdue.reduce((s, l) => s + (l.outstanding || 0), 0);
  const totalRepaid      = closed.reduce((s, l) => s + (l.principal || 0), 0);
  const totalInterest    = loans.reduce((s, l) => s + (l.charges || 0), 0);
  
  // Normalize statuses for accurate filtering
  const normalizedLoans = loans.map(l => ({
    ...l,
    status: !l.status ? 'open' : 
            (l.status === 'Follow Up!' || l.status === 'follow_up') ? 'open' :
            (l.status === 'Open') ? 'open' :
            (l.status === 'Closed') ? 'closed' :
            (l.status === 'Overdue') ? 'overdue' :
            (l.status === 'Rejected') ? 'rejected' : l.status
  }));
  
  const normalizedActive = normalizedLoans.filter(l => l.status === 'open');
  const normalizedTotalDisbursed = normalizedActive.reduce((s, l) => s + (l.principal || 0), 0);

  // ── Status Distribution (pie) ──────────────────────────────────
  const statusGroups = ['draft','pending_cluster_approval','pending_zonal_approval','approved','disbursed','repaid','overdue','rejected'];
  const statusData = statusGroups
    .map(s => ({ name: s.replace(/_/g, ' '), value: loans.filter(l => l.status === s).length }))
    .filter(d => d.value > 0);

  // ── Loan Amount Buckets ─────────────────────────────────────────
  const buckets = [
    { label: '< ₹1L',   min: 0,       max: 100000 },
    { label: '₹1–5L',   min: 100000,  max: 500000 },
    { label: '₹5–10L',  min: 500000,  max: 1000000 },
    { label: '₹10–25L', min: 1000000, max: 2500000 },
    { label: '> ₹25L',  min: 2500000, max: Infinity },
  ];
  const bucketData = buckets.map(b => ({
    label: b.label,
    count: loans.filter(l => (l.principal || 0) >= b.min && (l.principal || 0) < b.max).length,
    amount: loans.filter(l => (l.principal || 0) >= b.min && (l.principal || 0) < b.max).reduce((s, l) => s + (l.principal || 0), 0),
  }));

  // ── Branch / Manager Performance ────────────────────────────────
  const branchMap = {};
  loans.forEach(l => {
    const key = l.branch || 'Unassigned';
    if (!branchMap[key]) branchMap[key] = { branch: key, total: 0, active: 0, overdue: 0, closed: 0, amount: 0, overdueAmt: 0 };
    branchMap[key].total++;
    branchMap[key].amount += l.principal || 0;
    if (l.status === 'open') branchMap[key].active++;
    if (l.status === 'overdue')   { branchMap[key].overdue++; branchMap[key].overdueAmt += l.outstanding || 0; }
    if (l.status === 'closed')    branchMap[key].closed++;
  });
  const branchData = Object.values(branchMap).sort((a, b) => b.amount - a.amount);

  // ── Collection Monthly Trend ──────────────────────────────────────
  const monthMap = {};
  collections.forEach(c => {
    if (!c.credit_note_date) return;
    const key = format(new Date(c.credit_note_date), 'MMM yy');
    if (!monthMap[key]) monthMap[key] = { month: key, amount: 0, count: 0 };
    monthMap[key].amount += c.amount_collected || 0;
    monthMap[key].count++;
  });
  const trendData = Object.values(monthMap).slice(-8);

  // ── Overdue ageing ─────────────────────────────────────────────
  const ageing = [
    { label: '1–30 days',  min: 1,   max: 30  },
    { label: '31–60 days', min: 31,  max: 60  },
    { label: '61–90 days', min: 61,  max: 90  },
    { label: '> 90 days',  min: 91,  max: 9999 },
  ];
  const ageingData = ageing.map(a => ({
    label: a.label,
    count: overdue.filter(l => {
      const d = l.disbursement_date ? differenceInDays(new Date(), new Date(l.disbursement_date)) : 0;
      return d >= a.min && d <= a.max;
    }).length,
    amount: overdue.filter(l => {
      const d = l.disbursement_date ? differenceInDays(new Date(), new Date(l.disbursement_date)) : 0;
      return d >= a.min && d <= a.max;
    }).reduce((s, l) => s + (l.outstanding || 0), 0),
  }));

  // Daily MIS calculations
  const dailyData = {};
  collections.forEach(c => {
    const date = c.credit_note_date || format(new Date(), 'yyyy-MM-dd');
    if (!dailyData[date]) dailyData[date] = { collections: [], disbursals: [], collAmt: 0, disbAmt: 0 };
    dailyData[date].collections.push(c);
    dailyData[date].collAmt += c.amount_collected || 0;
  });
  disbursals.forEach(d => {
    const date = d.debit_note_date || format(new Date(), 'yyyy-MM-dd');
    if (!dailyData[date]) dailyData[date] = { collections: [], disbursals: [], collAmt: 0, disbAmt: 0 };
    dailyData[date].disbursals.push(d);
    dailyData[date].disbAmt += d.principal || 0;
  });

  // Cluster-wise performance
  const clusterMap = {};
  loans.forEach(l => {
    const cluster = l.cluster || 'Unassigned';
    if (!clusterMap[cluster]) clusterMap[cluster] = { cluster, loans: [], principal: 0, charges: 0, closed: 0 };
    clusterMap[cluster].loans.push(l);
    clusterMap[cluster].principal += l.principal || 0;
    clusterMap[cluster].charges += (l.charges != null ? l.charges : (l.principal || 0) * (l.rate || 0.5) / 100);
    if (l.status === 'closed') clusterMap[cluster].closed++;
  });
  const clusterData = Object.values(clusterMap).sort((a, b) => b.principal - a.principal);

  return (
    <div className="space-y-6">

      {/* ── Tab bar ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center px-5 pt-4 pb-0 border-b border-border gap-0">
          {[
            { key: 'mis', label: 'Consolidated MIS' },
            { key: 'dashboard', label: 'Dashboard Reports' },
            { key: 'export', label: 'Export Data' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Consolidated MIS tab */}
        {activeTab === 'mis' && (
          <div className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-syne font-bold text-sm">Consolidated MIS Report</h3>
              <p className="text-xs text-muted-foreground mt-1">All open cases across all clusters on letterhead</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => downloadReport('consolidated_mis')}
              disabled={!!downloading}
            >
              {downloading === 'consolidated_mis' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading === 'consolidated_mis' ? 'Generating...' : 'Download MIS Report'}
            </Button>
          </div>
        )}

        {/* Export Data tab */}
        {activeTab === 'export' && <ExportPanel />}

        {/* Dashboard Reports tab */}
        {activeTab === 'dashboard' && (
          <div className="p-5">
            <div className="mb-4">
              <h3 className="font-syne font-bold text-sm">Dashboard Performance Reports</h3>
              <p className="text-xs text-muted-foreground mt-1">Portfolio overview on BridgeLine letterhead — same layout as the dashboard</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MTD Card */}
              <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm">MTD Report</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(), 'MMMM yyyy')} — month-wise breakdown, goalpost & cluster analytics
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 shrink-0"
                  onClick={() => downloadDashboardReport('mtd')}
                  disabled={!!downloading}
                >
                  {downloading === 'dashboard_mtd' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {downloading === 'dashboard_mtd' ? 'Generating...' : 'Download MTD'}
                </Button>
              </div>

              {/* YTD Card */}
              <div className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm">YTD Report</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date().getFullYear()} — all months breakdown & cluster analytics
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 shrink-0"
                  onClick={() => downloadDashboardReport('ytd')}
                  disabled={!!downloading}
                >
                  {downloading === 'dashboard_ytd' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {downloading === 'dashboard_ytd' ? 'Generating...' : 'Download YTD'}
                </Button>
              </div>
            </div>

            {/* Collection Report section */}
            <div className="mt-6">
              <h4 className="font-syne font-bold text-sm mb-1">Collection Report</h4>
              <p className="text-xs text-muted-foreground mb-3">Detailed breakdown of all collections — principal, charges, GST, penalty, UTR</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Collection MTD */}
                <div className="border border-border rounded-xl p-4">
                  <div className="mb-3">
                    <div className="font-semibold text-sm">MTD Collections</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(), 'MMMM yyyy')}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1"
                      onClick={() => downloadCollectionReport('mtd', 'excel')} disabled={!!downloading}>
                      {downloading === 'collection_mtd_excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} className="text-green-600" />}
                      {downloading === 'collection_mtd_excel' ? 'Generating...' : 'Excel'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1"
                      onClick={() => downloadCollectionReport('mtd', 'pdf')} disabled={!!downloading}>
                      {downloading === 'collection_mtd_pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-red-500" />}
                      {downloading === 'collection_mtd_pdf' ? 'Generating...' : 'PDF'}
                    </Button>
                  </div>
                </div>

                {/* Collection YTD */}
                <div className="border border-border rounded-xl p-4">
                  <div className="mb-3">
                    <div className="font-semibold text-sm">YTD Collections</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Jan – {format(new Date(), 'MMM yyyy')}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1"
                      onClick={() => downloadCollectionReport('ytd', 'excel')} disabled={!!downloading}>
                      {downloading === 'collection_ytd_excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} className="text-green-600" />}
                      {downloading === 'collection_ytd_excel' ? 'Generating...' : 'Excel'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1"
                      onClick={() => downloadCollectionReport('ytd', 'pdf')} disabled={!!downloading}>
                      {downloading === 'collection_ytd_pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-red-500" />}
                      {downloading === 'collection_ytd_pdf' ? 'Generating...' : 'PDF'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
  }