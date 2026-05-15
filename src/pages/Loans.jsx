import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { formatINR, calcCharges, calcGST, calcOutstanding } from '@/lib/mis';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Plus, Search, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_STYLES = {
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  pending_cluster_approval: 'bg-yellow-100 text-yellow-800',
  pending_zonal_approval: 'bg-orange-100 text-orange-800',
  rejected: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS = {
  open: 'Open',
  closed: 'Closed',
  overdue: 'Overdue',
  pending_cluster_approval: 'Pending Cluster',
  pending_zonal_approval: 'Pending Zonal',
  rejected: 'Rejected',
};

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [soFilter, setSoFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { user } = useCurrentUser();

  useEffect(() => {
    base44.entities.Loan.list('-created_date', 200).then(l => {
      setLoans(l);
      setLoading(false);
    });
  }, []);

  const isAdmin = user?.role === 'admin';

  const clusters = [...new Set(loans.map(l => l.cluster).filter(Boolean))].sort();
  const soNames = [...new Set(loans.map(l => l.so_name).filter(Boolean))].sort();

  const filtered = loans.filter(l => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchCluster = clusterFilter === 'all' || l.cluster === clusterFilter;
    const matchSO = soFilter === 'all' || l.so_name === soFilter;
    const matchDateFrom = !dateFrom || (l.disbursement_date && l.disbursement_date >= dateFrom);
    const matchDateTo = !dateTo || (l.disbursement_date && l.disbursement_date <= dateTo);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (l.borrower_name || '').toLowerCase().includes(q) ||
      (l.loan_number || '').toLowerCase().includes(q) ||
      (l.branch || '').toLowerCase().includes(q) ||
      (l.cluster || '').toLowerCase().includes(q) ||
      (l.so_name || '').toLowerCase().includes(q);
    return matchStatus && matchCluster && matchSO && matchDateFrom && matchDateTo && matchSearch;
  });

  const hasFilters = clusterFilter !== 'all' || soFilter !== 'all' || dateFrom || dateTo;
  const clearFilters = () => { setClusterFilter('all'); setSoFilter('all'); setDateFrom(''); setDateTo(''); };

  const statusCounts = loans.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-syne font-bold text-xl text-foreground">Cases</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{loans.length} total cases</p>
        </div>
        {isAdmin && (
          <Link to="/loans/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={15} />
              New Case
            </Button>
          </Link>
        )}
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {[['all', 'All', loans.length], ...Object.entries(STATUS_LABELS).map(([k, v]) => [k, v, statusCounts[k] || 0])].map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {label} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, loan #, branch, cluster, SO…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={clusterFilter} onValueChange={setClusterFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Cluster" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clusters</SelectItem>
              {clusters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={soFilter} onValueChange={setSoFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="SO Name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SOs</SelectItem>
              {soNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" placeholder="From date" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-xs" placeholder="To date" />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X size={12} /> Clear filters
            </button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} cases</span>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground uppercase tracking-wide">
              {['#', 'Date', 'Customer', 'Cluster/Branch', 'Principal', 'Charges', 'Outstanding', 'Status', ''].map(h => (
                <th key={h} className={`px-2 py-2 font-medium ${['Principal','Charges','Outstanding'].includes(h) ? 'text-right' : h === '' ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No cases found</td></tr>
            ) : filtered.map((l, i) => {
              const charges = calcCharges(l);
              const outstanding = calcOutstanding(l);
              return (
                <tr key={l.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => window.location.href = `/loans/${l.id}`}>
                  <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{l.disbursement_date ? format(new Date(l.disbursement_date), 'dd-MMM') : '—'}</td>
                  <td className="px-2 py-2 font-medium max-w-[150px] truncate">{l.borrower_name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{[l.cluster, l.branch].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-2 py-2 text-right font-semibold">{formatINR(l.principal)}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{formatINR(charges)}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${l.status === 'overdue' ? 'text-red-600' : ''}`}>{formatINR(outstanding)}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[l.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[l.status] || l.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ChevronRight size={14} className="text-muted-foreground inline" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No cases found</div>
        ) : filtered.map(l => {
          const outstanding = calcOutstanding(l);
          return (
            <Link key={l.id} to={`/loans/${l.id}`} className="block bg-card rounded-xl border border-border p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-foreground text-sm">{l.borrower_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{l.branch || '—'} · {l.cluster || '—'}</div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[l.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[l.status] || l.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">Principal: </span>
                  <span className="font-semibold">{formatINR(l.principal)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Outstanding: </span>
                  <span className={`font-semibold ${l.status === 'overdue' ? 'text-red-600' : 'text-primary'}`}>{formatINR(outstanding)}</span>
                </div>
              </div>
              {l.disbursement_date && (
                <div className="text-xs text-muted-foreground mt-1">
                  Disbursed: {format(new Date(l.disbursement_date), 'dd-MMM-yyyy')}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}