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
  const { user, isAdmin, isBranchManager, isClusterManager, isZonalManager } = useCurrentUser();

  const isBranchStage  = loan.status === 'pending_branch_approval';
  const isClusterStage = loan.status === 'pending_cluster_approval';
  const isZonalStage   = loan.status === 'pending_zonal_approval';

  // No pending action needed
  if (!isBranchStage && !isClusterStage && !isZonalStage) return null;

  // Gate access: branch managers only act on branch stage; cluster managers on cluster stage; zonal on zonal
  if (!isAdmin) {
    if (isBranchStage && !isBranchManager)   return <div className="text-xs text-muted-foreground p-4">Awaiting Branch Manager approval.</div>;
    if (isClusterStage && !isClusterManager)  return <div className="text-xs text-muted-foreground p-4">Awaiting Cluster Manager approval.</div>;
    if (isZonalStage && !isZonalManager)      return <div className="text-xs text-muted-foreground p-4">Awaiting Zonal Manager approval.</div>;
  }

  const requiresZonal = (loan.principal || 0) >= 1000000;
  const actorName = user?.full_name || user?.email || 'Manager';

  const stageColor = isBranchStage ? 'blue' : isClusterStage ? 'yellow' : 'orange';
  const roleLabel  = isBranchStage ? 'Branch Manager' : isClusterStage ? 'Cluster Manager' : 'Zonal Manager';

  const colorMap = {
    blue:   { border: 'border-blue-200',   bg: 'bg-blue-50',   title: 'text-blue-800',   icon: 'text-blue-600' },
    yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', title: 'text-yellow-800', icon: 'text-yellow-600' },
    orange: { border: 'border-orange-200', bg: 'bg-orange-50', title: 'text-orange-800', icon: 'text-orange-600' },
  };
  const c = colorMap[stageColor];

  const handleApprove = async () => {
    setSaving(true);
    const now = new Date().toISOString();

    if (isBranchStage) {
      // Branch approves → goes to cluster
      await base44.entities.Loan.update(loan.id, {
        status: 'pending_cluster_approval',
        approval_stage: 'cluster',
        branch_manager_notes: notes,
        approved_by_branch: actorName,
        branch_approved_date: now,
      });
    } else if (isClusterStage) {
      if (requiresZonal) {
        // Cluster approves, needs zonal
        await base44.entities.Loan.update(loan.id, {
          status: 'pending_zonal_approval',
          approval_stage: 'zonal',
          cluster_manager_notes: notes,
          approved_by_cluster: actorName,
          cluster_approved_date: now,
        });
      } else {
        // Cluster is final approval → open
        await base44.entities.Loan.update(loan.id, {
          status: 'open',
          approval_stage: 'complete',
          cluster_manager_notes: notes,
          approved_by_cluster: actorName,
          cluster_approved_date: now,
        });
      }
    } else if (isZonalStage) {
      // Zonal final approval → open
      await base44.entities.Loan.update(loan.id, {
        status: 'open',
        approval_stage: 'complete',
        zonal_manager_notes: notes,
        approved_by_zonal: actorName,
        zonal_approved_date: now,
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

  const nextStageLabel = isBranchStage
    ? 'Cluster Manager'
    : isClusterStage && requiresZonal
    ? 'Zonal Manager'
    : null;

  return (
    <div className={cn('rounded-xl border p-5 space-y-4', c.border, c.bg)}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className={c.icon} />
        <h3 className={cn('font-syne font-semibold text-sm', c.title)}>
          Action Required — {roleLabel}
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
              placeholder="Add any comments or conditions…"
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
              {saving ? 'Processing…' : nextStageLabel ? `Approve & Send to ${nextStageLabel}` : 'Approve Loan'}
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
            <Button variant="destructive" onClick={handleReject} disabled={saving || !rejectNotes.trim()}>
              {saving ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
            <Button variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}