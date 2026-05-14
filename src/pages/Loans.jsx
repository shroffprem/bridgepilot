import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatINR, calcCharges, calcGST, calcOutstanding } from '@/lib/mis';

const STATUS_LABELS = { pending_approval: 'Pending Approval', open: 'Open', closed: 'Closed', overdue: 'Overdue' };
const STATUS_STYLES = {
  pending_approval: 'bg-blue-100 text-blue-800',
  open: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.Loan.list('-disbursement_date').then(l => { setLoans(l); setLoading(false); });
  }, []);

  const clusters = [...new Set(loans.map(l => l.cluster).filter(Boolean))].sort();
  const today = new Date();

  const filtered = loans.filter(l => {
    const matchSearch = !search || l.borrower_name?.toLowerCase().includes(search.toLowerCase()) || l.loan_number?.toLowerCase().includes(search.toLowerCase()) || l.branch?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchCluster = clusterFilter === 'all' || l.cluster === clusterFilter;
    return matchSearch && matchStatus && matchCluster;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by customer, loan #, branch…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clusterFilter} onValueChange={setClusterFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All clusters" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clusters</SelectItem>
            {clusters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => navigate('/loans/new')} className="gap-2 ml-auto">
          <Plus size={16} /> New Case
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FileText size={40} className="mb-3 opacity-30" />
              <p>No cases found</p>
              <Button onClick={() => navigate('/loans/new')} className="mt-4 gap-2" size="sm"><Plus size={14} /> New Case</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Cluster</th>
                    <th className="text-left px-4 py-3 font-medium">Branch</th>
                    <th className="text-right px-4 py-3 font-medium">Principal</th>
                    <th className="text-right px-4 py-3 font-medium">Charges</th>
                    <th className="text-right px-4 py-3 font-medium">GST</th>
                    <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                    <th className="text-right px-4 py-3 font-medium">Days</th>
                    <th className="text-right px-4 py-3 font-medium">Rate</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const charges = calcCharges(l);
                    const gst = l.gst != null ? l.gst : calcGST(charges);
                    const outstanding = calcOutstanding(l);
                    const days = l.disbursement_date ? Math.round((today - new Date(l.disbursement_date)) / 86400000) : 0;
                    return (
                      <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/loans/${l.id}`)}>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{l.disbursement_date ? format(new Date(l.disbursement_date), 'dd-MMM-yy') : '—'}</td>
                        <td className="px-4 py-3 font-semibold">{l.borrower_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{l.cluster || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{l.branch || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatINR(l.principal)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(charges)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(gst)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${l.status === 'overdue' ? 'text-red-600' : ''}`}>{l.status === 'closed' ? '—' : formatINR(outstanding)}</td>
                        <td className={`px-4 py-3 text-right text-xs font-mono ${days > 7 ? 'text-red-500' : 'text-muted-foreground'}`}>{l.status === 'closed' ? '✓' : days}</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">{l.rate ? `${l.rate}%` : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[l.status] || 'bg-muted text-muted-foreground'}`}>
                            {STATUS_LABELS[l.status] || l.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}