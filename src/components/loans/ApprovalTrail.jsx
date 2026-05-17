import { CheckCircle2, Clock, XCircle, Circle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STAGES = [
  { key: 'branch',  label: 'Sales Officer',    desc: 'Loan request raised at branch' },
  { key: 'branch_mgr', label: 'Branch Manager', desc: 'Branch-level review & approval' },
  { key: 'cluster', label: 'Cluster Manager',  desc: 'First-level management approval' },
  { key: 'zonal',   label: 'Zonal Manager',    desc: 'Required for loans > ₹10L' },
  { key: 'disbursed', label: 'Disbursement',   desc: 'Funds released to borrower' },
];

function stageStatus(stageKey, loan) {
  const { status, approval_stage, principal } = loan;
  const requiresZonal = (principal || 0) >= 1000000;

  if (status === 'rejected') {
    if (stageKey === 'branch') return 'done';
    if (stageKey === 'branch_mgr') {
      if (approval_stage === 'branch' || status === 'pending_branch_approval') return 'rejected';
      return 'done';
    }
    if (stageKey === 'cluster') {
      if (approval_stage === 'cluster' || status === 'pending_cluster_approval') return 'rejected';
      if (['zonal', 'complete'].includes(approval_stage)) return 'done';
      return 'pending';
    }
    if (stageKey === 'zonal') {
      if (approval_stage === 'zonal' || status === 'pending_zonal_approval') return 'rejected';
      return 'pending';
    }
    return 'pending';
  }

  if (stageKey === 'branch') return 'done'; // Always done — submitted

  if (stageKey === 'branch_mgr') {
    if (status === 'pending_branch_approval') return 'active';
    if (loan.approved_by_branch) return 'done';
    // Legacy loans that skipped branch stage
    if (['pending_cluster_approval', 'pending_zonal_approval', 'open', 'closed', 'overdue'].includes(status)) return 'done';
    return 'pending';
  }

  if (stageKey === 'cluster') {
    if (status === 'pending_cluster_approval') return 'active';
    if (['pending_zonal_approval', 'open', 'closed', 'overdue'].includes(status)) return 'done';
    return 'pending';
  }

  if (stageKey === 'zonal') {
    if (!requiresZonal) return 'skipped';
    if (status === 'pending_zonal_approval') return 'active';
    if (['open', 'closed', 'overdue'].includes(status)) return 'done';
    return 'pending';
  }

  if (stageKey === 'disbursed') {
    if (['closed', 'overdue', 'follow_up'].includes(status)) return 'done';
    if (status === 'open') return 'active';
    return 'pending';
  }

  return 'pending';
}

export default function ApprovalTrail({ loan }) {
  const requiresZonal = (loan.principal || 0) >= 1000000;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-syne font-semibold text-sm text-foreground mb-5">Approval Trail</h3>
      <div className="relative">
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />
        <div className="space-y-5">
          {STAGES.filter(s => s.key !== 'zonal' || requiresZonal).map((stage) => {
            const st = stageStatus(stage.key, loan);

            const icon = st === 'done'     ? <CheckCircle2 size={18} className="text-green-600" />
                       : st === 'active'   ? <Clock size={18} className="text-yellow-500 animate-pulse" />
                       : st === 'rejected' ? <XCircle size={18} className="text-red-500" />
                       : st === 'skipped'  ? <MinusCircle size={18} className="text-muted-foreground/30" />
                       :                    <Circle size={18} className="text-muted-foreground/40" />;

            const labelClass = st === 'done'     ? 'text-foreground'
                             : st === 'active'   ? 'text-yellow-700 font-semibold'
                             : st === 'rejected' ? 'text-red-600'
                             : st === 'skipped'  ? 'text-muted-foreground/40'
                             : 'text-muted-foreground';

            return (
              <div key={stage.key} className="flex gap-4 items-start relative z-10">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  st === 'done'     ? 'bg-green-50'
                  : st === 'active' ? 'bg-yellow-50'
                  : st === 'rejected' ? 'bg-red-50'
                  : 'bg-muted'
                )}>
                  {icon}
                </div>
                <div className="flex-1 pt-0.5">
                  <div className={cn('text-sm font-medium', labelClass)}>{stage.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stage.desc}</div>

                  {/* Branch Manager approval details */}
                  {stage.key === 'branch_mgr' && loan.approved_by_branch && st === 'done' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Approved by <span className="font-medium text-foreground">{loan.approved_by_branch}</span>
                      {loan.branch_approved_date && (
                        <span className="ml-1">· {format(new Date(loan.branch_approved_date), 'dd MMM yyyy, h:mm a')}</span>
                      )}
                      {loan.branch_manager_notes && <div className="mt-0.5 italic">"{loan.branch_manager_notes}"</div>}
                    </div>
                  )}

                  {/* Cluster Manager approval details */}
                  {stage.key === 'cluster' && loan.approved_by_cluster && st === 'done' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Approved by <span className="font-medium text-foreground">{loan.approved_by_cluster}</span>
                      {loan.cluster_approved_date && (
                        <span className="ml-1">· {format(new Date(loan.cluster_approved_date), 'dd MMM yyyy, h:mm a')}</span>
                      )}
                      {loan.cluster_manager_notes && <div className="mt-0.5 italic">"{loan.cluster_manager_notes}"</div>}
                    </div>
                  )}

                  {/* Zonal Manager approval details */}
                  {stage.key === 'zonal' && loan.approved_by_zonal && st === 'done' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Approved by <span className="font-medium text-foreground">{loan.approved_by_zonal}</span>
                      {loan.zonal_approved_date && (
                        <span className="ml-1">· {format(new Date(loan.zonal_approved_date), 'dd MMM yyyy, h:mm a')}</span>
                      )}
                      {loan.zonal_manager_notes && <div className="mt-0.5 italic">"{loan.zonal_manager_notes}"</div>}
                    </div>
                  )}

                  {/* Rejection details */}
                  {st === 'rejected' && loan.rejection_reason && (
                    <div className="mt-1 text-xs text-red-600">Rejected: "{loan.rejection_reason}"</div>
                  )}

                  {/* Active waiting badges */}
                  {st === 'active' && stage.key === 'branch_mgr' && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                      <Clock size={10} /> Awaiting Branch Manager
                    </div>
                  )}
                  {st === 'active' && stage.key === 'cluster' && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-2 py-0.5">
                      <Clock size={10} /> Awaiting Cluster Manager
                    </div>
                  )}
                  {st === 'active' && stage.key === 'zonal' && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
                      <Clock size={10} /> Awaiting Zonal Manager
                    </div>
                  )}
                  {st === 'skipped' && (
                    <div className="text-xs text-muted-foreground/40">Not required (loan ≤ ₹10L)</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}