import { CheckCircle2, Clock, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STAGES = [
  { key: 'branch',  label: 'Branch Manager',  desc: 'Loan request raised' },
  { key: 'cluster', label: 'Cluster Manager', desc: 'First-level approval' },
  { key: 'zonal',   label: 'Zonal Manager',   desc: 'Required for loans > ₹10L' },
  { key: 'disbursed', label: 'Disbursement',  desc: 'Funds released to borrower' },
];

function stageStatus(stageKey, loan) {
  const { status, approval_stage, amount } = loan;
  const requiresZonal = (amount || 0) >= 1000000;

  if (status === 'rejected') {
    // Find where it was rejected
    if (stageKey === 'branch') return 'done';
    if (stageKey === 'cluster' && ['pending_cluster_approval'].includes(status)) return 'rejected';
    if (stageKey === 'cluster' && approval_stage === 'zonal') return 'done';
    if (stageKey === 'zonal' && status === 'pending_zonal_approval') return 'rejected';
    return 'rejected';
  }

  if (stageKey === 'branch') return 'done';

  if (stageKey === 'cluster') {
    if (status === 'pending_cluster_approval') return 'active';
    if (['pending_zonal_approval', 'approved', 'disbursed', 'repaid', 'overdue'].includes(status)) return 'done';
    return 'pending';
  }

  if (stageKey === 'zonal') {
    if (!requiresZonal) return 'skipped';
    if (status === 'pending_zonal_approval') return 'active';
    if (['approved', 'disbursed', 'repaid', 'overdue'].includes(status)) return 'done';
    return 'pending';
  }

  if (stageKey === 'disbursed') {
    if (['disbursed', 'repaid', 'overdue'].includes(status)) return 'done';
    if (status === 'approved') return 'active';
    return 'pending';
  }

  return 'pending';
}

export default function ApprovalTrail({ loan }) {
  const requiresZonal = (loan.amount || 0) >= 1000000;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-syne font-semibold text-sm text-foreground mb-5">Approval Trail</h3>
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />

        <div className="space-y-5">
          {STAGES.filter(s => s.key !== 'zonal' || requiresZonal).map((stage, idx) => {
            const st = stageStatus(stage.key, loan);

            const icon = st === 'done'     ? <CheckCircle2 size={18} className="text-green-600" />
                       : st === 'active'   ? <Clock size={18} className="text-yellow-500 animate-pulse" />
                       : st === 'rejected' ? <XCircle size={18} className="text-red-500" />
                       : st === 'skipped'  ? <Circle size={18} className="text-muted-foreground/30" />
                       :                    <Circle size={18} className="text-muted-foreground/40" />;

            const labelClass = st === 'done'     ? 'text-foreground'
                             : st === 'active'   ? 'text-yellow-700 font-semibold'
                             : st === 'rejected' ? 'text-red-600'
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

                  {/* Show who approved + when + notes */}
                  {stage.key === 'cluster' && loan.approved_by_cluster && st === 'done' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Approved by <span className="font-medium text-foreground">{loan.approved_by_cluster}</span>
                      {loan.cluster_approved_date && (
                        <span className="ml-1 text-muted-foreground">· {format(new Date(loan.cluster_approved_date), 'dd MMM yyyy, h:mm a')}</span>
                      )}
                      {loan.cluster_manager_notes && <div className="mt-0.5 italic">"{loan.cluster_manager_notes}"</div>}
                    </div>
                  )}
                  {stage.key === 'zonal' && loan.approved_by_zonal && st === 'done' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Approved by <span className="font-medium text-foreground">{loan.approved_by_zonal}</span>
                      {loan.zonal_approved_date && (
                        <span className="ml-1 text-muted-foreground">· {format(new Date(loan.zonal_approved_date), 'dd MMM yyyy, h:mm a')}</span>
                      )}
                      {loan.zonal_manager_notes && <div className="mt-0.5 italic">"{loan.zonal_manager_notes}"</div>}
                    </div>
                  )}
                  {loan.status === 'rejected' && stage.key === (loan.approval_stage === 'zonal' ? 'zonal' : 'cluster') && loan.rejection_reason && (
                    <div className="mt-1 text-xs text-red-600">Rejected: "{loan.rejection_reason}"</div>
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}