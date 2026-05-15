import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { formatINR } from '@/lib/mis';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

function fmt(d) { return d ? format(parseISO(d), 'dd MMM yyyy') : '—'; }

export default function Ledger() {
  const [disbursals, setDisbursals] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter: month picker (default = current month)
  const today = new Date();
  const [month, setMonth] = useState(format(today, 'yyyy-MM'));

  useEffect(() => {
    Promise.all([
      base44.entities.Disbursal.list(),
      base44.entities.Collection.list(),
    ]).then(([d, c]) => { setDisbursals(d); setCollections(c); setLoading(false); });
  }, []);

  const { rows, totalOut, totalIn, net } = useMemo(() => {
    const start = startOfMonth(parseISO(month + '-01'));
    const end   = endOfMonth(start);

    // Filter to selected month
    const filteredD = disbursals.filter(d => {
      const dt = d.debit_note_date ? parseISO(d.debit_note_date) : null;
      return dt && dt >= start && dt <= end;
    });
    const filteredC = collections.filter(c => {
      const dt = c.credit_note_date ? parseISO(c.credit_note_date) : null;
      return dt && dt >= start && dt <= end;
    });

    // Build unified daily entries
    const entries = [
      ...filteredD.map(d => ({
        date: d.debit_note_date,
        type: 'out',
        label: d.borrower_name || '—',
        ref: d.debit_note_number || '—',
        branch: d.branch || '—',
        amount: d.principal || 0,
        loan_id: d.loan_id || null,
        loan_number: d.loan_number || '—',
        note: d.notes || '',
      })),
      ...filteredC.map(c => ({
        date: c.credit_note_date,
        type: 'in',
        label: c.borrower_name || '—',
        ref: c.credit_note_number || '—',
        branch: c.branch || '—',
        amount: c.amount_collected || 0,
        loan_id: c.loan_id || null,
        loan_number: c.loan_number || '—',
        note: c.notes || '',
      })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Group by date
    const byDate = {};
    for (const e of entries) {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    }

    // Build rows with running balance
    let running = 0;
    const rows = [];
    for (const date of Object.keys(byDate).sort()) {
      const dayEntries = byDate[date];
      const dayOut = dayEntries.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0);
      const dayIn  = dayEntries.filter(e => e.type === 'in').reduce((s, e) => s + e.amount, 0);
      const dayNet = dayIn - dayOut;
      running += dayNet;
      rows.push({ date, entries: dayEntries, dayOut, dayIn, dayNet, running });
    }

    const totalOut = filteredD.reduce((s, d) => s + (d.principal || 0), 0);
    const totalIn  = filteredC.reduce((s, c) => s + (c.amount_collected || 0), 0);
    const net      = totalIn - totalOut;
    return { rows, totalOut, totalIn, net };
  }, [disbursals, collections, month]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-syne font-bold text-xl text-foreground">Daily Cash Ledger</h1>
          <p className="text-sm text-muted-foreground">Disbursals vs Collections — net cash movement by day</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-input rounded-lg px-3 py-1.5 text-sm bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
            <ArrowUpRight size={18} className="text-red-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Disbursed (Out)</div>
            <div className="font-syne font-bold text-lg text-red-600">{formatINR(totalOut)}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <ArrowDownLeft size={18} className="text-green-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Collected (In)</div>
            <div className="font-syne font-bold text-lg text-green-600">{formatINR(totalIn)}</div>
          </div>
        </div>
        <div className={`bg-card border rounded-xl p-4 flex items-center gap-3 ${net >= 0 ? 'border-green-300' : 'border-red-300'}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${net >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            {net > 0 ? <TrendingUp size={18} className="text-green-600" /> : net < 0 ? <TrendingDown size={18} className="text-red-600" /> : <Minus size={18} className="text-muted-foreground" />}
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Net Cash Flow</div>
            <div className={`font-syne font-bold text-lg ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{net >= 0 ? '+' : ''}{formatINR(net)}</div>
          </div>
        </div>
      </div>

      {/* Ledger table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No transactions found for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Borrower</th>
                  <th className="text-left px-4 py-2.5 font-medium">Case #</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ref</th>
                  <th className="text-left px-4 py-2.5 font-medium">Branch</th>
                  <th className="text-right px-4 py-2.5 font-medium text-red-600">Out (₹)</th>
                  <th className="text-right px-4 py-2.5 font-medium text-green-600">In (₹)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Day Net</th>
                  <th className="text-right px-4 py-2.5 font-medium">Running</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ date, entries, dayOut, dayIn, dayNet, running }) => (
                  <>
                    {entries.map((e, i) => (
                      <tr key={`${date}-${i}`} className="border-t border-border hover:bg-muted/20">
                        {i === 0 ? (
                          <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap" rowSpan={entries.length}>
                            {fmt(date)}
                          </td>
                        ) : null}
                        <td className="px-4 py-2.5">
                          {e.type === 'out' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              <ArrowUpRight size={11} /> Disbursal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              <ArrowDownLeft size={11} /> Collection
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{e.label}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">
                          {e.loan_id ? (
                            <Link to={`/loans/${e.loan_id}`} className="text-primary hover:underline">{e.loan_number}</Link>
                          ) : (
                            <span className="text-muted-foreground">{e.loan_number}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{e.ref}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{e.branch}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                          {e.type === 'out' ? formatINR(e.amount) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                          {e.type === 'in' ? formatINR(e.amount) : '—'}
                        </td>
                        {i === 0 ? (
                          <>
                            <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${dayNet >= 0 ? 'text-green-600' : 'text-red-600'}`} rowSpan={entries.length}>
                              {dayNet >= 0 ? '+' : ''}{formatINR(dayNet)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${running >= 0 ? 'text-foreground' : 'text-red-600'}`} rowSpan={entries.length}>
                              {formatINR(running)}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                    {/* Day subtotal row */}
                    <tr className="bg-muted/40 border-t border-border text-xs font-semibold text-muted-foreground">
                      <td className="px-4 py-1.5 pl-8" colSpan={6}>
                        {fmt(date)} — {entries.length} transaction{entries.length > 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-1.5 text-right text-red-600">{formatINR(dayOut)}</td>
                      <td className="px-4 py-1.5 text-right text-green-600">{formatINR(dayIn)}</td>
                      <td colSpan={2} />
                    </tr>
                  </>
                ))}
              </tbody>
              {/* Grand total */}
              <tfoot>
                <tr className="bg-muted/60 border-t-2 border-border font-bold text-sm">
                  <td colSpan={6} className="px-4 py-3">TOTAL — {format(parseISO(month + '-01'), 'MMMM yyyy')}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatINR(totalOut)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatINR(totalIn)}</td>
                  <td className={`px-4 py-3 text-right ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{net >= 0 ? '+' : ''}{formatINR(net)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}