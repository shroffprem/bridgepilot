import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Search, Filter, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/ui/StatusBadge';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

const ALL_STATUSES = ['draft', 'pending_cluster_approval', 'pending_zonal_approval', 'approved', 'disbursed', 'repaid', 'overdue', 'rejected'];

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.Loan.list('-created_date').then(l => { setLoans(l); setLoading(false); });
  }, []);

  const filtered = loans.filter(l => {
    const matchSearch = l.borrower_name?.toLowerCase().includes(search.toLowerCase()) || l.loan_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by borrower or loan #…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => navigate('/loans/new')} className="gap-2 ml-auto">
          <Plus size={16} /> New Application
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FileText size={40} className="mb-3 opacity-30" />
              <p>No loans found</p>
              <Button onClick={() => navigate('/loans/new')} className="mt-4 gap-2" size="sm"><Plus size={14} /> New Application</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Loan #</th>
                  <th className="text-left px-5 py-3 font-medium">Borrower</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-right px-5 py-3 font-medium">Interest</th>
                  <th className="text-left px-5 py-3 font-medium">Maturity</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(loan => (
                  <tr key={loan.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/loans/${loan.id}`)}>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{loan.loan_number || '—'}</td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">{loan.borrower_name}</td>
                    <td className="px-5 py-3.5 text-right font-semibold">{formatINR(loan.amount)}</td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground">{loan.interest_rate}%</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{loan.maturity_date ? format(new Date(loan.maturity_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={loan.status} /></td>
                    <td className="px-5 py-3.5">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); navigate(`/loans/${loan.id}`); }}>View</Button>
                    </td>
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