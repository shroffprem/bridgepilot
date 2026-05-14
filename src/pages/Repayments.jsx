import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Search, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n?.toLocaleString('en-IN')}`;
}

export default function Repayments() {
  const [repayments, setRepayments] = useState([]);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Repayment.list('-payment_date').then(r => { setRepayments(r); setLoading(false); });
  }, []);

  const filtered = repayments.filter(r => {
    const matchSearch = r.borrower_name?.toLowerCase().includes(search.toLowerCase()) || r.loan_number?.toLowerCase().includes(search.toLowerCase());
    const matchMode = modeFilter === 'all' || r.payment_mode === modeFilter;
    return matchSearch && matchMode;
  });

  const total = filtered.reduce((s, r) => s + (r.amount_received || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Total Repayments</div>
          <div className="text-2xl font-bold font-syne mt-1">{repayments.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Total Amount Received</div>
          <div className="text-2xl font-bold font-syne mt-1 text-green-600">{formatINR(repayments.reduce((s, r) => s + (r.amount_received || 0), 0))}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Showing (filtered)</div>
          <div className="text-2xl font-bold font-syne mt-1">{formatINR(total)}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by borrower or loan #…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All modes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            {['bank_transfer','cash','cheque','upi','other'].map(m => <SelectItem key={m} value={m}>{m.replace('_',' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <CreditCard size={40} className="mb-3 opacity-30" />
              <p>No repayments found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Borrower</th>
                  <th className="text-left px-5 py-3 font-medium">Loan #</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-right px-5 py-3 font-medium">Principal</th>
                  <th className="text-right px-5 py-3 font-medium">Interest</th>
                  <th className="text-left px-5 py-3 font-medium">Mode</th>
                  <th className="text-left px-5 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3">{r.payment_date}</td>
                    <td className="px-5 py-3 font-semibold">{r.borrower_name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.loan_number}</td>
                    <td className="px-5 py-3 text-right font-bold text-green-600">{formatINR(r.amount_received)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{formatINR(r.principal_component)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{formatINR(r.interest_component)}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{r.payment_mode?.replace('_', ' ')}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.reference_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}