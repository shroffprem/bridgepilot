import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { format } from 'date-fns';
import { Eye, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import ApprovalTrail from '@/components/loans/ApprovalTrail';
import ApprovalActionPanel from '@/components/loans/ApprovalActionPanel';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n?.toLocaleString('en-IN')}`;
}

function LoanRow({ loan, onUpdate, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const requiresZonal = (loan.amount || 0) >= 1000000;

  return (
    <div className="border-b border-border last:border-0">
      {/* Summary Row */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
          <div>
            <div className="text-xs text-muted-foreground font-mono">{loan.loan_number}</div>
            <div className="font-semibold text-sm text-foreground">{loan.borrower_name}</div>
          </div>
          <div className="text-right md:text-left">
            <div className="font-bold text-sm">{formatINR(loan.amount)}</div>
            {requiresZonal && (
              <div className="text-xs text-orange-600 font-medium">Zonal required</div>
            )}
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">{loan.branch || '—'}</div>
          <div className="hidden md:block text-xs text-muted-foreground">
            {loan.created_date ? format(new Date(loan.created_date), 'dd MMM yyyy') : '—'}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <StatusBadge status={loan.status} />
          </div>
        </div>
        <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/loans/${loan.id}`)}>
            <Eye size={14} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </Button>
        </div>
      </div>

      {/* Expanded Panel */}
      {expanded && (
        <div className="bg-muted/20 border-t border-border px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ApprovalTrail loan={loan} />
          <ApprovalActionPanel loan={loan} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

function LoanTable({ items, title, onUpdate, navigate }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <h3 className="font-syne font-semibold text-sm text-foreground">{title}</h3>
        <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full">
          {items.length}
        </span>
        <span className="text-xs text-muted-foreground ml-1">Click a row to review & act</span>
      </div>
      {items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <CheckSquare size={32} className="opacity-30" />
          No pending approvals
        </div>
      ) : (
        <div>
          {/* Header */}
          <div className="bg-muted/40 border-b border-border px-5 py-2 hidden md:grid grid-cols-5 gap-3 text-xs text-muted-foreground uppercase font-medium tracking-wide">
            <div>Borrower</div>
            <div>Amount</div>
            <div>Branch</div>
            <div>Submitted</div>
            <div>Status</div>
          </div>
          {items.map(loan => (
            <LoanRow key={loan.id} loan={loan} onUpdate={onUpdate} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Approvals() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, isClusterManager, isZonalManager, isAdmin } = useCurrentUser();

  const load = () =>
    base44.entities.Loan.list('-created_date').then(all => {
      const pending = all.filter(l => ['pending_cluster_approval', 'pending_zonal_approval'].includes(l.status));
      // Cluster managers only see their cluster's pending loans
      if (isClusterManager && user?.cluster) {
        setLoans(pending.filter(l => l.cluster?.toLowerCase() === user.cluster?.toLowerCase()));
      } else {
        setLoans(pending);
      }
      setLoading(false);
    });

  useEffect(() => { load(); }, [isClusterManager, user?.cluster]);

  // Zonal managers only see zonal queue; cluster managers only see cluster queue
  const clusterPending = loans.filter(l => l.status === 'pending_cluster_approval');
  const zonalPending   = loans.filter(l => l.status === 'pending_zonal_approval');

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const showClusterQueue = isAdmin || isClusterManager;
  const showZonalQueue   = isAdmin || isZonalManager;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4">
        {showClusterQueue && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="text-xs text-yellow-700 font-medium">Pending Cluster Approval</div>
            <div className="text-2xl font-bold font-syne text-yellow-800 mt-1">{clusterPending.length}</div>
          </div>
        )}
        {showZonalQueue && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="text-xs text-orange-700 font-medium">Pending Zonal Approval (&gt;₹10L)</div>
            <div className="text-2xl font-bold font-syne text-orange-800 mt-1">{zonalPending.length}</div>
          </div>
        )}
      </div>

      {showClusterQueue && (
        <LoanTable
          items={clusterPending}
          title={`Cluster Manager Approval Queue${isClusterManager && user?.cluster ? ` — ${user.cluster}` : ''}`}
          onUpdate={load}
          navigate={navigate}
        />
      )}
      {showZonalQueue && (
        <LoanTable
          items={zonalPending}
          title="Zonal Manager Approval Queue (Loans > ₹10L)"
          onUpdate={load}
          navigate={navigate}
        />
      )}
    </div>
  );
}