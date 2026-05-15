import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, differenceInDays } from 'date-fns';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';
import { IndianRupee, TrendingUp, Users, AlertTriangle, CreditCard, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        // Create blob from response
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
    <div className="space-y-8">

      {/* ── Download Section ── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-syne font-bold text-sm">Report Downloads</h3>
            <p className="text-xs text-muted-foreground mt-1">Export data as PDF</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => downloadReport('consolidated_mis')}
              disabled={downloading}
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Generating...' : 'Download MIS Report'}
            </Button>
          </div>
        </div>
      </div>





      </div>
      );
      }