import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, className, iconBg = 'bg-accent', iconColor = 'text-primary' }) {
  return (
    <div className={cn('bg-card rounded-xl border border-border p-5 flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold font-syne text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon size={18} className={iconColor} />
          </div>
        )}
      </div>
      {trend && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          {trend}
        </div>
      )}
    </div>
  );
}