import { cn } from '@/lib/utils';

const statusConfig = {
  draft:                    { label: 'Draft',              className: 'bg-muted text-muted-foreground' },
  pending_cluster_approval: { label: 'Pending Cluster',   className: 'bg-yellow-100 text-yellow-800' },
  pending_zonal_approval:   { label: 'Pending Zonal',     className: 'bg-orange-100 text-orange-800' },
  approved:                 { label: 'Approved',           className: 'bg-blue-100 text-blue-800' },
  disbursed:                { label: 'Disbursed',          className: 'bg-purple-100 text-purple-800' },
  repaid:                   { label: 'Repaid',             className: 'bg-green-100 text-green-800' },
  overdue:                  { label: 'Overdue',            className: 'bg-red-100 text-red-800' },
  rejected:                 { label: 'Rejected',           className: 'bg-gray-100 text-gray-600' },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}