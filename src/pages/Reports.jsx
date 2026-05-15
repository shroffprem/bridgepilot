import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, differenceInDays } from 'date-fns';
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
  const [repayments, setRepayments] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Loan.list(),
      base44.entities.Repayment.list(),
      base44.entities.Collection.list(),
    ]).then(([l, r, c]) => {
      setLoans(l);
      setRepayments(r);
      setCollections(c);
      setLoading(false);
    });
  }, []);

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

  // ── Collection Activity Performance by Handler ─────────────────
  const handlerMap = {};
  collections.forEach(c => {
    const key = c.handled_by || 'Unassigned';
    if (!handlerMap[key]) handlerMap[key] = { handler: key, total: 0, calls: 0, visits: 0, promises: 0, promiseAmt: 0 };
    handlerMap[key].total++;
    if (c.activity_type === 'call')             handlerMap[key].calls++;
    if (c.activity_type === 'visit')            handlerMap[key].visits++;
    if (c.activity_type === 'payment_promise')  { handlerMap[key].promises++; handlerMap[key].promiseAmt += c.promise_amount || 0; }
  });
  const handlerData = Object.values(handlerMap).sort((a, b) => b.total - a.total);

  // ── Repayment Monthly Trend ─────────────────────────────────────
  const monthMap = {};
  repayments.forEach(r => {
    if (!r.payment_date) return;
    const key = format(new Date(r.payment_date), 'MMM yy');
    if (!monthMap[key]) monthMap[key] = { month: key, amount: 0, count: 0 };
    monthMap[key].amount += r.amount_received || 0;
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
      const d = l.maturity_date ? differenceInDays(new Date(), new Date(l.maturity_date)) : 0;
      return d >= a.min && d <= a.max;
    }).length,
    amount: overdue.filter(l => {
      const d = l.maturity_date ? differenceInDays(new Date(), new Date(l.maturity_date)) : 0;
      return d >= a.min && d <= a.max;
    }).reduce((s, l) => s + (l.total_repayable || l.amount || 0), 0),
  }));

  return (
    <div className="space-y-8">

      {/* ── Portfolio KPIs ── */}
      <div>
        <SectionHeader title="Portfolio Overview" sub="Live snapshot of your lending book" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Open Loans" value={active.length} sub={`₹ ${formatINR(totalDisbursed)} active`} icon={TrendingUp} color="blue" />
          <StatCard title="Total Disbursed" value={formatINR(totalDisbursed)} sub={`across ${active.length} cases`} icon={IndianRupee} color="green" />
          <StatCard title="Overdue Exposure" value={formatINR(totalOverdue)} sub={`${overdue.length} loans overdue`} icon={AlertTriangle} color="red" />
          <StatCard title="Total Closed" value={formatINR(totalRepaid)} sub={`Charges earned: ${formatINR(totalInterest)}`} icon={CreditCard} color="purple" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <StatCard title="Pending Approvals" value={pending.length} sub="Awaiting action" icon={Users} color="yellow" />
          <StatCard title="Closed Loans" value={closed.length} sub="Fully collected" icon={CreditCard} color="green" />
          <StatCard title="Total Borrowers" value={new Set(loans.map(l => l.borrower_id).filter(Boolean)).size} sub="Unique businesses" icon={Users} color="blue" />
          <StatCard title="Total Loans" value={loans.length} sub="All time" icon={IndianRupee} color="purple" />
        </div>
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Pie */}
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeader title="Loan Status Distribution" />
          {statusData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                {statusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="capitalize">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Loan Size Buckets */}
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeader title="Loan Size Distribution" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bucketData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [n === 'count' ? v : formatINR(v), n === 'count' ? 'Loans' : 'Amount']} />
              <Bar dataKey="count" name="Loans" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Repayment Trend ── */}
      {trendData.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeader title="Monthly Repayment Trend" sub="Amount collected per month" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatINR(v)} />
              <Tooltip formatter={v => formatINR(v)} />
              <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Repaid" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Overdue Ageing ── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <SectionHeader title="Overdue Ageing Bucket" sub="How long loans have been overdue" />
        {overdue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No overdue loans 🎉</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase">
                <th className="text-left px-2 py-2 font-medium">Ageing Bucket</th>
                <th className="text-right px-2 py-2 font-medium">Loans</th>
                <th className="text-right px-2 py-2 font-medium">Amount at Risk</th>
                <th className="text-right px-2 py-2 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {ageingData.map(a => (
                <tr key={a.label} className="border-b border-border last:border-0">
                  <td className="px-2 py-2 font-medium">{a.label}</td>
                  <td className="px-2 py-2 text-right">{a.count}</td>
                  <td className="px-2 py-2 text-right text-red-600 font-semibold">{formatINR(a.amount)}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">
                    {totalOverdue > 0 ? ((a.amount / totalOverdue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Branch / Manager Performance ── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <SectionHeader title="Branch-wise Loan Performance" sub="Breakdown by branch / manager" />
        {branchData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No branch data</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase">
                <th className="text-left px-2 py-2 font-medium">Branch</th>
                <th className="text-right px-2 py-2 font-medium">Loans</th>
                <th className="text-right px-2 py-2 font-medium">Amount</th>
                <th className="text-right px-2 py-2 font-medium">Active</th>
                <th className="text-right px-2 py-2 font-medium">Closed</th>
                <th className="text-right px-2 py-2 font-medium">Overdue</th>
                <th className="text-right px-2 py-2 font-medium">Overdue Amt</th>
                <th className="text-right px-2 py-2 font-medium">Recovery</th>
              </tr>
            </thead>
            <tbody>
              {branchData.map(b => {
                const recoveryRate = b.total > 0 ? ((b.closed / b.total) * 100).toFixed(0) : 0;
                return (
                  <tr key={b.branch} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-2 py-2 font-semibold">{b.branch}</td>
                    <td className="px-2 py-2 text-right">{b.total}</td>
                    <td className="px-2 py-2 text-right font-medium">{formatINR(b.amount)}</td>
                    <td className="px-2 py-2 text-right text-blue-600">{b.active}</td>
                    <td className="px-2 py-2 text-right text-green-600">{b.closed}</td>
                    <td className="px-2 py-2 text-right text-red-600">{b.overdue}</td>
                    <td className="px-2 py-2 text-right text-red-600 font-semibold">{formatINR(b.overdueAmt)}</td>
                    <td className="px-2 py-2 text-right">
                      <span className={`font-semibold ${Number(recoveryRate) >= 70 ? 'text-green-600' : Number(recoveryRate) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {recoveryRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Collections Handler Performance ── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <SectionHeader title="Collections — Manager Performance" sub="Activity logged by each collection handler" />
        {handlerData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No collection activities logged yet</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={handlerData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="handler" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="calls"   name="Calls"   fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="visits"  name="Visits"  fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="promises" name="Promises" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <table className="w-full text-xs mt-4">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase">
                  <th className="text-left px-2 py-2 font-medium">Handler</th>
                  <th className="text-right px-2 py-2 font-medium">Total</th>
                  <th className="text-right px-2 py-2 font-medium">Calls</th>
                  <th className="text-right px-2 py-2 font-medium">Visits</th>
                  <th className="text-right px-2 py-2 font-medium">Promises</th>
                  <th className="text-right px-2 py-2 font-medium">Promise Amt</th>
                </tr>
              </thead>
              <tbody>
                {handlerData.map(h => (
                  <tr key={h.handler} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-2 py-2 font-semibold">{h.handler}</td>
                    <td className="px-2 py-2 text-right">{h.total}</td>
                    <td className="px-2 py-2 text-right text-blue-600">{h.calls}</td>
                    <td className="px-2 py-2 text-right text-green-600">{h.visits}</td>
                    <td className="px-2 py-2 text-right text-yellow-600">{h.promises}</td>
                    <td className="px-2 py-2 text-right font-semibold">{formatINR(h.promiseAmt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

    </div>
  );
}