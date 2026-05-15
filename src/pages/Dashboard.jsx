import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { format, endOfMonth, differenceInDays, getYear } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR, formatINRFull, calcCharges, calcGST, calcOutstanding, clusterSummary, monthlyBreakdown, calcROI, avgTAT } from '@/lib/mis';
import { Target } from 'lucide-react';
import OverdueAgeing from '@/components/dashboard/OverdueAgeing';


function KPI({ label, value, sub, accent }) {
  return (
    <div className={`bg-card rounded-xl border border-border p-4 ${accent ? 'border-l-4 border-l-primary' : ''}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="font-syne font-bold text-xl text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [loans, setLoans] = useState([]);
  const [capitalEntries, setCapitalEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Loan.list(),
      base44.entities.CapitalEntry.list(),
    ]).then(([l, c]) => { setLoans(l); setCapitalEntries(c); setLoading(false); });
  }, []);

  const [portfolioTab, setPortfolioTab] = useState('mtd');

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const today = new Date();
  const currentYear = getYear(today);
  const currentMonth = format(today, 'MMM yyyy');

  const openLoans = loans.filter(l => l.status === 'open' || l.status === 'overdue' || l.status === 'pending_approval');
  const closedLoans = loans.filter(l => l.status === 'closed');
  const overdueLoans = loans.filter(l => l.status === 'overdue');

  // MTD — disbursed this calendar month
  const mtdLoans = loans.filter(l => l.disbursement_date && format(new Date(l.disbursement_date), 'MMM yyyy') === currentMonth);
  // YTD — disbursed this calendar year
  const ytdLoans = loans.filter(l => l.disbursement_date && getYear(new Date(l.disbursement_date)) === currentYear);

  function summaryOf(set) {
    const volume = set.reduce((s, l) => s + (l.principal || 0), 0);
    const charges = set.reduce((s, l) => s + calcCharges(l), 0);
    const gst = set.reduce((s, l) => s + (l.gst != null ? l.gst : calcGST(calcCharges(l))), 0);
    const outstanding = set.filter(l => l.status !== 'closed').reduce((s, l) => s + calcOutstanding(l), 0);
    const collected = set.filter(l => l.status === 'closed').reduce((s, l) => s + (l.principal || 0) + calcCharges(l), 0);
    const closed = set.filter(l => l.status === 'closed').length;
    const open = set.filter(l => l.status === 'open' || l.status === 'overdue').length;
    const roi = volume > 0 ? ((charges / volume) * 100).toFixed(3) : '0';
    return { volume, charges, gst, outstanding, collected, closed, open, roi, cases: set.length };
  }

  const mtd = summaryOf(mtdLoans);
  const ytd = summaryOf(ytdLoans);
  const active = portfolioTab === 'mtd' ? mtd : ytd;
  const activeLoans = portfolioTab === 'mtd' ? mtdLoans : ytdLoans;

  // Monthly goalpost — target is 4% of capital deployed
  const monthlyTarget = capitalDeployed * 0.04;
  const daysLeftInMonth = differenceInDays(endOfMonth(today), today) + 1;
  const remaining = Math.max(0, monthlyTarget - mtd.charges);
  const pctAchieved = monthlyTarget > 0 ? Math.min(100, (mtd.charges / monthlyTarget) * 100) : 0;
  const dailyChargeNeeded = daysLeftInMonth > 0 ? remaining / daysLeftInMonth : 0;

  // Capital deployed (live from CapitalEntry records)
  const capitalDeployed = capitalEntries.reduce((s, e) => e.type === 'addition' ? s + e.amount : s - e.amount, 0);

  // All-time
  const allTimeCharges = loans.reduce((s, l) => s + calcCharges(l), 0);

  // Cluster summary
  const clusters = clusterSummary(loans);

  // Monthly breakdown for chart (always all-time for chart context)
  const monthly = monthlyBreakdown(loans);
  const chartData = monthly.map(m => ({
    month: m.month,
    Volume: Math.round(m.volume / 100000),
    Charges: Math.round(m.charges / 1000),
  }));

  // Month-wise breakdown for active tab
  const activeMonthly = portfolioTab === 'mtd'
    ? monthly.filter(m => m.month === currentMonth)
    : monthly.filter(m => {
        const parts = m.month.split(' ');
        return parts.length === 2 && parseInt(parts[1]) === currentYear;
      });

  // Open cases table
  const openCases = openLoans.map(l => {
    const charges = calcCharges(l);
    const gst = l.gst != null ? l.gst : calcGST(charges);
    const outstanding = calcOutstanding(l);
    const days = l.disbursement_date ? Math.round((today - new Date(l.disbursement_date)) / 86400000) : 0;
    return { ...l, _charges: charges, _gst: gst, _outstanding: outstanding, _days: days };
  }).sort((a, b) => a._days - b._days);

  return (
    <div className="space-y-6">
      {/* ── Section 1: Portfolio Overview — MTD / YTD tabs ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-border">
          <h2 className="font-syne font-bold text-sm text-foreground uppercase tracking-wide">Portfolio Overview</h2>
          <div className="flex gap-0">
            {[['mtd', `MTD — ${format(today, 'MMM yyyy')}`], ['ytd', `YTD — ${currentYear}`]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPortfolioTab(key)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                  portfolioTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-border">
          {[
            { label: 'Cases Disbursed', value: active.cases, sub: `${active.open} open · ${active.closed} closed` },
            { label: 'Volume Disbursed', value: formatINR(active.volume), sub: 'Principal', accent: true },
            { label: 'Charges Earned', value: formatINR(active.charges), sub: `+ ${formatINR(active.gst)} GST`, accent: true },
            { label: 'Outstanding', value: formatINR(active.outstanding), sub: 'Active cases' },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} className={`p-4 ${accent ? 'bg-accent/20' : ''}`}>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
              <div className="font-syne font-bold text-xl text-foreground">{value}</div>
              {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
            </div>
          ))}
        </div>

        {/* Month-wise table inside the tab */}
        <div className="border-t border-border">
          <div className="px-5 py-3 bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {portfolioTab === 'mtd' ? `${format(today, 'MMMM yyyy')} Breakdown` : `${currentYear} — Month-wise Breakdown`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                  {['Month', 'Cases', 'Volume', 'Charges', 'GST', 'Collected', 'Outstanding', 'Closed', 'Open', 'ROI%'].map(h => (
                    <th key={h} className={`px-3 py-2 font-medium ${h === 'Month' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeMonthly.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-6 text-muted-foreground text-sm">No data for this period</td></tr>
                ) : activeMonthly.map(m => {
                  const roi = m.volume > 0 ? ((m.charges / m.volume) * 100).toFixed(3) : '0';
                  const isCurrent = m.month === currentMonth;
                  return (
                    <tr key={m.month} className={`border-t border-border ${isCurrent ? 'bg-accent/20 font-semibold' : 'hover:bg-muted/30'}`}>
                      <td className="px-3 py-2.5">{m.month}</td>
                      <td className="px-3 py-2.5 text-right">{m.cases}</td>
                      <td className="px-3 py-2.5 text-right">{formatINR(m.volume)}</td>
                      <td className="px-3 py-2.5 text-right text-primary font-semibold">{formatINR(m.charges)}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{formatINR(m.gst)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600">{formatINR(m.collected)}</td>
                      <td className={`px-3 py-2.5 text-right ${m.outstanding > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>{formatINR(m.outstanding)}</td>
                      <td className="px-3 py-2.5 text-right">{m.closed}</td>
                      <td className="px-3 py-2.5 text-right">{m.open}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-primary">{roi}%</td>
                    </tr>
                  );
                })}
              </tbody>
              {activeMonthly.length > 1 && (() => {
                const tot = activeMonthly.reduce((s, m) => ({
                  cases: s.cases + m.cases, volume: s.volume + m.volume, charges: s.charges + m.charges,
                  gst: s.gst + m.gst, collected: s.collected + m.collected, outstanding: s.outstanding + m.outstanding,
                  closed: s.closed + m.closed, open: s.open + m.open,
                }), { cases: 0, volume: 0, charges: 0, gst: 0, collected: 0, outstanding: 0, closed: 0, open: 0 });
                const roi = tot.volume > 0 ? ((tot.charges / tot.volume) * 100).toFixed(3) : '0';
                return (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/60 font-bold text-sm">
                      <td className="px-3 py-2.5">TOTAL</td>
                      <td className="px-3 py-2.5 text-right">{tot.cases}</td>
                      <td className="px-3 py-2.5 text-right">{formatINR(tot.volume)}</td>
                      <td className="px-3 py-2.5 text-right text-primary">{formatINR(tot.charges)}</td>
                      <td className="px-3 py-2.5 text-right">{formatINR(tot.gst)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600">{formatINR(tot.collected)}</td>
                      <td className="px-3 py-2.5 text-right text-red-600">{formatINR(tot.outstanding)}</td>
                      <td className="px-3 py-2.5 text-right">{tot.closed}</td>
                      <td className="px-3 py-2.5 text-right">{tot.open}</td>
                      <td className="px-3 py-2.5 text-right text-primary">{roi}%</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      </div>

      {/* ── Section 2: Monthly Goalpost ── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-primary" />
            <h3 className="font-syne font-semibold text-sm">Monthly ROI Goalpost — {format(today, 'MMM yyyy')} <span className="text-muted-foreground font-normal">(4% of {formatINR(capitalDeployed)} deployed)</span></h3>
          </div>
          <span className="text-sm font-semibold text-primary">{pctAchieved.toFixed(1)}% achieved</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 mb-4 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctAchieved}%` }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          {[
            { label: 'Capital Deployed', value: formatINR(capitalDeployed) },
            { label: 'Charges Earned', value: formatINR(mtd.charges) },
            { label: 'Remaining', value: formatINR(remaining) },
            { label: 'Days Left', value: daysLeftInMonth },
            { label: 'Daily Charge Needed', value: formatINR(dailyChargeNeeded) },
            { label: 'Target (4%)', value: formatINR(monthlyTarget) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className="font-syne font-bold text-sm text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Overdue Ageing ── */}
      <OverdueAgeing loans={loans} />

      {/* ── Section 3: Open Cases Table ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-syne font-semibold text-sm">Open Cases — All Clusters</h3>
          <Link to="/loans" className="text-xs text-primary hover:underline">View All Loans →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">#</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium">Cluster</th>
                <th className="text-left px-4 py-2.5 font-medium">Branch</th>
                <th className="text-right px-4 py-2.5 font-medium">Principal</th>
                <th className="text-right px-4 py-2.5 font-medium">Charges</th>
                <th className="text-right px-4 py-2.5 font-medium">GST</th>
                <th className="text-right px-4 py-2.5 font-medium">Outstanding</th>
                <th className="text-right px-4 py-2.5 font-medium">Days</th>
                <th className="text-right px-4 py-2.5 font-medium">Rate</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {openCases.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-10 text-muted-foreground">No open cases</td></tr>
              ) : openCases.map((l, i) => (
                <tr key={l.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => window.location.href=`/loans/${l.id}`}>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{l.disbursement_date ? format(new Date(l.disbursement_date), 'dd-MMM-yyyy') : '—'}</td>
                  <td className="px-4 py-2.5 font-medium">{l.borrower_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.cluster || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.branch || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatINR(l.principal)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{formatINR(l._charges)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{formatINR(l._gst)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${l.status === 'overdue' ? 'text-red-600' : 'text-foreground'}`}>{formatINR(l._outstanding)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${l._days > 7 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>{l._days}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">{l.rate ? `${l.rate}%` : '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Follow Up!</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {openCases.length > 0 && (
              <tfoot>
                <tr className="bg-muted/60 border-t-2 border-border font-bold text-sm">
                  <td colSpan={5} className="px-4 py-2.5">TOTAL ({openCases.length} cases)</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(openCases.reduce((s, l) => s + (l.principal||0), 0))}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(openCases.reduce((s, l) => s + l._charges, 0))}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(openCases.reduce((s, l) => s + l._gst, 0))}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(openCases.reduce((s, l) => s + l._outstanding, 0))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Section 4: Cluster Summary ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-syne font-semibold text-sm">Cluster Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Cluster</th>
                <th className="text-right px-4 py-2.5 font-medium">Cases</th>
                <th className="text-right px-4 py-2.5 font-medium">Principal</th>
                <th className="text-right px-4 py-2.5 font-medium">Charges</th>
                <th className="text-right px-4 py-2.5 font-medium">GST</th>
                <th className="text-right px-4 py-2.5 font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {clusters.filter(c => c.cases > 0 && openLoans.some(l => (l.cluster||'Other') === c.cluster)).map(c => {
                const openInCluster = openLoans.filter(l => (l.cluster||'Other') === c.cluster);
                const principal = openInCluster.reduce((s,l) => s+(l.principal||0), 0);
                const charges = openInCluster.reduce((s,l) => s+calcCharges(l), 0);
                const gst = openInCluster.reduce((s,l) => s+(l.gst!=null?l.gst:calcGST(calcCharges(l))), 0);
                const outstanding = openInCluster.reduce((s,l) => s+calcOutstanding(l), 0);
                return (
                  <tr key={c.cluster} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{c.cluster}</td>
                    <td className="px-4 py-2.5 text-right">{openInCluster.length}</td>
                    <td className="px-4 py-2.5 text-right">{formatINR(principal)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatINR(charges)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatINR(gst)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary">{formatINR(outstanding)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Cluster Analytics YTD + Month-wise ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cluster Analytics YTD */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-syne font-semibold text-sm">Cluster Analytics — YTD</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground uppercase">
                <th className="text-left px-4 py-2 font-medium">Cluster</th>
                <th className="text-right px-4 py-2 font-medium">Cases</th>
                <th className="text-right px-4 py-2 font-medium">Closed</th>
                <th className="text-right px-4 py-2 font-medium">Volume</th>
                <th className="text-right px-4 py-2 font-medium">Charges</th>
                <th className="text-right px-4 py-2 font-medium">Avg TAT</th>
                <th className="text-right px-4 py-2 font-medium">ROI%</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c, i) => {
                const tat = avgTAT(c.loans);
                const roi = calcROI(c.principal, c.charges);
                return (
                  <tr key={c.cluster} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">
                      <span className="text-xs text-muted-foreground mr-2">#{i+1}</span>{c.cluster}
                    </td>
                    <td className="px-4 py-2.5 text-right">{c.cases}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-medium">{c.closed}</td>
                    <td className="px-4 py-2.5 text-right">{formatINR(c.principal)}</td>
                    <td className="px-4 py-2.5 text-right text-primary font-semibold">{formatINR(c.charges)}</td>
                    <td className={`px-4 py-2.5 text-right text-xs font-mono ${tat && parseFloat(tat) > 1.5 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>{tat ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-primary">{roi.toFixed(3)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Month-wise Volume chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm mb-4">Monthly Volume (₹L) & Charges (₹K)</h3>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v, n) => [n === 'Volume' ? `₹${v}L` : `₹${v}K`, n]} />
                <Bar dataKey="Volume" fill="hsl(var(--primary))" radius={[3,3,0,0]} />
                <Bar dataKey="Charges" fill="hsl(var(--success))" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>


    </div>
  );
}