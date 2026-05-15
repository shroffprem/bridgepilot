import { Link } from 'react-router-dom';
import { calcOutstanding } from '@/lib/mis';
import { differenceInDays } from 'date-fns';
import { formatINR } from '@/lib/mis';

const BUCKETS = [
  { label: '1–7 days', min: 1, max: 7, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { label: '1–2 weeks', min: 8, max: 14, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { label: '2–3 weeks', min: 15, max: 21, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { label: '3–4 weeks', min: 22, max: 28, color: 'text-red-500 bg-red-50 border-red-200' },
  { label: '4–6 weeks', min: 29, max: 42, color: 'text-red-700 bg-red-100 border-red-300' },
  { label: '6+ weeks', min: 43, max: Infinity, color: 'text-red-900 bg-red-200 border-red-400' },
];

export default function OverdueAgeing({ loans }) {
  const overdueLoans = loans.filter(l => l.status === 'overdue' && l.disbursement_date);

  if (overdueLoans.length === 0) return null;

  const today = new Date();
  const bucketed = BUCKETS.map(b => ({
    ...b,
    loans: overdueLoans.filter(l => {
      const days = differenceInDays(today, new Date(l.disbursement_date));
      return days >= b.min && days <= b.max;
    }),
  })).filter(b => b.loans.length > 0);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h3 className="font-syne font-semibold text-sm">Overdue Ageing Buckets</h3>
        <span className="ml-auto text-xs text-muted-foreground">{overdueLoans.length} overdue cases</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-border">
        {BUCKETS.map(b => {
          const group = overdueLoans.filter(l => {
            const days = differenceInDays(today, new Date(l.disbursement_date));
            return days >= b.min && days <= b.max;
          });
          const total = group.reduce((s, l) => s + calcOutstanding(l), 0);
          return (
            <div key={b.label} className="p-4">
              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border mb-2 ${b.color}`}>{b.label}</div>
              <div className="font-syne font-bold text-lg text-foreground">{group.length}</div>
              <div className="text-xs text-muted-foreground">cases</div>
              <div className="text-sm font-semibold text-red-600 mt-1">{formatINR(total)}</div>
              <div className="text-xs text-muted-foreground">outstanding</div>
            </div>
          );
        })}
      </div>
      {/* Top overdue cases */}
      <div className="px-5 pb-4">
        <div className="space-y-1 mt-2">
          {overdueLoans.slice(0, 5).map(l => {
            const days = differenceInDays(today, new Date(l.disbursement_date));
            return (
              <Link key={l.id} to={`/loans/${l.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 text-sm">
                <div>
                  <span className="font-medium">{l.borrower_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{l.branch}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`font-mono font-bold ${days > 60 ? 'text-red-600' : 'text-orange-500'}`}>{days}d</span>
                  <span className="text-red-600 font-semibold">{formatINR(calcOutstanding(l))}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}