import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function ApprovalActionPanel({ loan, onUpdate }) {
  const [notes, setNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user, isZonalManager } = useCurrentUser();

  const isClusterStage = loan.status === 'pending_cluster_approval';
  const isZonalStage   = loan.status === 'pending_zonal_approval';

  // Zonal managers can only act on zonal-stage loans; cluster managers on cluster-stage
  if (!isClusterStage && !isZonalStage) return null;
  if (isZonalManager && !isZonalStage) return <div className="text-xs text-muted-foreground p-4">Awaiting cluster approval first.</div>;

  const requiresZonal = (loan.principal || 0) >= 1000000;
  const actorName = user?.full_name || user?.email || (isClusterStage ? 'Cluster Manager' : 'Zonal Manager');
  const role = isClusterStage ? 'Cluster Manager' : 'Zonal Manager';
  const nextStage = isClusterStage && requiresZonal ? 'Zonal Manager' : null;

  const handleApprove = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    if (isClusterStage) {
      await base44.entities.Loan.update(loan.id, requiresZonal
        ? { status: 'pending_zonal_approval', approval_stage: 'zonal', cluster_manager_notes: notes, approved_by_cluster: actorName, cluster_approved_date: now }
        : { status: 'open', approval_stage: 'complete', cluster_manager_notes: notes, approved_by_cluster: actorName, cluster_approved_date: now }
      );
    } else {
      await base44.entities.Loan.update(loan.id, {
        status: 'open', approval_stage: 'complete',
        zonal_manager_notes: notes, approved_by_zonal: actorName, zonal_approved_date: now
      });
    }
    setSaving(false);
    setNotes('');
    onUpdate();
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) return;
    setSaving(true);
    await base44.entities.Loan.update(loan.id, { status: 'rejected', rejection_reason: rejectNotes });
    setSaving(false);
    setRejectNotes('');
    setShowReject(false);
    onUpdate();
  };

  return (
    <div className={cn(
      'rounded-xl border p-5 space-y-4',
      isClusterStage ? 'bg-yellow-50 border-yellow-200' : 'bg-orange-50 border-orange-200'
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className={isClusterStage ? 'text-yellow-600' : 'text-orange-600'} />
        <h3 className={cn('font-syne font-semibold text-sm', isClusterStage ? 'text-yellow-800' : 'text-orange-800')}>
          Action Required — {role}
        </h3>
      </div>

      {isClusterStage && requiresZonal && (
        <div className="text-xs bg-white/60 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2">
          ⚠ This loan exceeds ₹10L. Approving here will escalate to <strong>Zonal Manager</strong> for final sign-off.
        </div>
      )}

      {!showReject ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes / Remarks (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Add any comments or conditions for approval…"
              className="bg-white"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={handleApprove}
              disabled={saving}
            >
              <CheckCircle2 size={15} />
              {saving ? 'Processing…' : nextStage ? `Approve & Escalate to ${nextStage}` : 'Approve Loan'}
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowReject(true)}
              disabled={saving}
            >
              <XCircle size={15} /> Reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-red-700 font-medium">Rejection Reason *</Label>
            <Textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              rows={3}
              placeholder="State the reason for rejecting this loan application…"
              className="bg-white border-red-200 focus:ring-red-300"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={saving || !rejectNotes.trim()}
            >
              {saving ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
            <Button variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}