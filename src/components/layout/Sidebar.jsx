import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Building2,
  BarChart2
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Loan Applications', icon: FileText, path: '/loans' },
  { label: 'Approvals', icon: CheckSquare, path: '/approvals' },
  { label: 'Borrowers', icon: Users, path: '/borrowers' },
  { label: 'Repayments', icon: CreditCard, path: '/repayments' },
  { label: 'Collections', icon: AlertTriangle, path: '/collections' },
  { label: 'Reports', icon: BarChart2, path: '/reports' },
  { label: 'Master Directory', icon: Building2, path: '/directory' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-30">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-syne font-bold text-white text-lg leading-none">LendOps</div>
            <div className="text-sidebar-foreground text-xs mt-0.5 opacity-60">SME Lending</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                isActive
                  ? 'bg-sidebar-primary text-white'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
              <span className="font-inter font-medium text-sm flex-1">{label}</span>
              {isActive && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="text-sidebar-foreground text-xs opacity-40 text-center">
          © 2026 LendOps
        </div>
      </div>
    </aside>
  );
}