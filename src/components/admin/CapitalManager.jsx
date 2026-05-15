import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, MinusCircle, Trash2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { formatINR } from '@/lib/mis';

export default function CapitalManager() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'addition', amount: '', date: format(new Date(), 'yyyy-MM-dd'), source: '', notes: '' });

  const fetchEntries = () => {
    base44.entities.CapitalEntry.list('-date').then(e => { setEntries(e); setLoading(false); });
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.CapitalEntry.create({ ...form, amount: parseFloat(form.amount), recorded_by: 'admin' });
    setForm({ type: 'addition', amount: '', date: format(new Date(), 'yyyy-MM-dd'), source: '', notes: '' });
    setSaving(false);
    fetchEntries();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this capital entry?')) return;
    await base44.entities.CapitalEntry.delete(id);
    fetchEntries();
  };

  // Compute running balance
  const netCapital = entries.reduce((s, e) => e.type === 'addition' ? s + e.amount : s - e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-accent/20 rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Capital Deployed</div>
          <div className="font-syne font-bold text-2xl text-primary">{formatINR(netCapital)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{entries.length} entries</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Additions</div>
          <div className="font-syne font-bold text-xl text-green-700">{formatINR(entries.filter(e => e.type === 'addition').reduce((s, e) => s + e.amount, 0))}</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Withdrawals</div>
          <div className="font-syne font-bold text-xl text-red-600">{formatINR(entries.filter(e => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0))}</div>
        </div>
      </div>

      {/* Add Entry Form */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-primary" />
          <h3 className="font-syne font-semibold text-sm">Record Capital Change</h3>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 w-36">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="addition">Addition ↑</SelectItem>
                <SelectItem value="withdrawal">Withdrawal ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-36">
            <Label>Amount (₹)</Label>
            <Input type="number" required min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 8500000" />
          </div>
          <div className="space-y-1 w-40">
            <Label>Date</Label>
            <Input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="space-y-1 flex-1 min-w-36">
            <Label>Source / Partner</Label>
            <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. Partner A" />
          </div>
          <div className="space-y-1 flex-1 min-w-36">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            {form.type === 'addition' ? <PlusCircle size={15} /> : <MinusCircle size={15} />}
            {saving ? 'Saving…' : 'Record'}
          </Button>
        </form>
      </div>

      {/* History Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <span className="font-syne font-semibold text-sm">Capital History</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No capital entries yet. Add the first one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium">Source</th>
                  <th className="text-left px-4 py-2.5 font-medium">Notes</th>
                  <th className="text-right px-4 py-2.5 font-medium">Running Balance</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Compute running balance oldest→newest, then reverse for display
                  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
                  let bal = 0;
                  const withBal = sorted.map(e => {
                    bal = e.type === 'addition' ? bal + e.amount : bal - e.amount;
                    return { ...e, _balance: bal };
                  });
                  return withBal.reverse().map(e => (
                    <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{e.date ? format(new Date(e.date), 'dd-MMM-yyyy') : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${e.type === 'addition' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {e.type === 'addition' ? '↑ Addition' : '↓ Withdrawal'}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${e.type === 'addition' ? 'text-green-600' : 'text-red-600'}`}>
                        {e.type === 'withdrawal' ? '−' : '+'}{formatINR(e.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.source || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{e.notes || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary">{formatINR(e._balance)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(e.id)}>
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}