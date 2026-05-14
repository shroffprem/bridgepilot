import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Eye, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ui/StatusBadge';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n?.toLocaleString('en-IN')}`;
}

export default function Approvals() {
  const [loans, setLoans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState(null); // 'approve' | 'reject'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () =>
    base44.entities.Loan.list('-created_date').then(all => {
      setLoans(all.filter(l => ['pending_cluster_approval', 'pending_zonal_approval'].includes(l.status)));
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const openAction = (loan, act) => { setSelected(loan); setAction(act); setNotes(''); setDialogOpen(true); };

  const handleConfirm = async () => {
    if (!selected) return;
    if (action === 'approve') {
      if (selected.status === 'pending_cluster_approval') {
        const requiresZonal = selected.amount >= 1000000;
        await base44.entities.Loan.update(selected.id, requiresZonal
          ? { status: 'pending_zonal_approval', approval_stage: 'zonal', cluster_manager_notes: notes, approved_by_cluster: 'Current User' }
          : { status: 'approved', approval_stage: 'complete', cluster_manager_notes: notes, approved_by_cluster: 'Current User' }
        );
      } else {
        await base44.entities.Loan.update(selected.id, { status: 'approved', approval_stage: 'complete', zonal_manager_notes: notes, approved_by_zonal: 'Current User' });
      }
    } else {
      await base44.entities.Loan.update(selected.id, { status: 'rejected', rejection_reason: notes });
    }
    setDialogOpen(false);
    load();
  };

  const clusterPending = loans.filter(l => l.status === 'pending_cluster_approval');
  const zonalPending = loans.filter(l => l.status === 'pending_zonal_approval');

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const LoanTable = ({ items, title, badge }) => (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <h3 className="font-syne font-semibold text-sm text-foreground">{title}</h3>
        <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <CheckSquare size={32} className="opacity-30" />
          No pending approvals
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase">
              <th className="text-left px-5 py-2.5 font-medium">Loan #</th>
              <th className="text-left px-5 py-2.5 font-medium">Borrower</th>
              <th className="text-right px-5 py-2.5 font-medium">Amount</th>
              <th className="text-left px-5 py-2.5 font-medium">Branch</th>
              <th className="text-left px-5 py-2.5 font-medium">Submitted</th>
              <th className="text-left px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {items.map(loan => (
              <tr key={loan.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{loan.loan_number}</td>
                <td className="px-5 py-3 font-semibold">{loan.borrower_name}</td>
                <td className="px-5 py-3 text-right font-semibold">{formatINR(loan.amount)}</td>
                <td className="px-5 py-3 text-muted-foreground">{loan.branch || '—'}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs">{loan.created_date ? format(new Date(loan.created_date), 'dd MMM yyyy') : '—'}</td>
                <td className="px-5 py-3"><StatusBadge status={loan.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/loans/${loan.id}`)}><Eye size={14} /></Button>
                    <Button size="sm" className="h-7 px-2.5 bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => openAction(loan, 'approve')}><CheckCircle2 size={13} /></Button>
                    <Button size="sm" variant="destructive" className="h-7 px-2.5 gap-1" onClick={() => openAction(loan, 'reject')}><XCircle size={13} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <LoanTable items={clusterPending} title="Pending Cluster Manager Approval" />
      <LoanTable items={zonalPending} title="Pending Zonal Manager Approval (>₹10L)" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={action === 'approve' ? 'text-green-700' : 'text-destructive'}>
              {action === 'approve' ? 'Approve Loan' : 'Reject Loan'}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-1">
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <div><span className="text-muted-foreground">Borrower: </span><span className="font-semibold">{selected.borrower_name}</span></div>
                <div><span className="text-muted-foreground">Amount: </span><span className="font-semibold">{formatINR(selected.amount)}</span></div>
                {action === 'approve' && selected.status === 'pending_cluster_approval' && selected.amount >= 1000000 && (
                  <div className="text-yellow-700 text-xs mt-1">⚠ Will escalate to Zonal Manager (amount &gt;₹10L)</div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{action === 'approve' ? 'Notes (optional)' : 'Rejection Reason *'}</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={action === 'approve' ? 'Add any notes…' : 'State the reason for rejection…'} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                  variant={action === 'reject' ? 'destructive' : 'default'}
                  onClick={handleConfirm}
                  disabled={action === 'reject' && !notes.trim()}
                >
                  {action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}