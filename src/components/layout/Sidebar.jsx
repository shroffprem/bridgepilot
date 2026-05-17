import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboard, FileText, Users, BarChart2,
  Building2, ShieldCheck, CheckSquare, LogOut, BookOpen, Landmark, BotMessageSquare,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ALL_NAV = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/',          roles: ['admin'] },
  { label: 'Cases',            icon: FileText,        path: '/loans',     roles: ['admin', 'branch_manager'] },
  { label: 'Approvals',        icon: CheckSquare,     path: '/approvals', roles: ['admin', 'branch_manager', 'cluster_manager', 'zonal_manager'] },
  { label: 'Reports',          icon: BarChart2,       path: '/reports',   roles: ['admin'] },
  { label: 'Borrowers',        icon: Users,           path: '/borrowers', roles: ['admin'] },
  { label: 'Master Directory', icon: Building2,       path: '/directory', roles: ['admin'] },
  { label: 'Partners & Territories', icon: Landmark,  path: '/companies', roles: ['admin'] },
  { label: 'Cash Ledger',     icon: BookOpen,        path: '/ledger',    roles: ['admin'] },
  { label: 'Repayment AI',   icon: BotMessageSquare, path: '/repayment-agent', roles: ['admin', 'branch_manager', 'cluster_manager', 'zonal_manager'] },
];
const ADMIN_NAV = [
  { label: 'Admin', icon: ShieldCheck, path: '/admin', roles: ['admin'] },
];

export default function Sidebar() {
  const location = useLocation();
  const { user } = useCurrentUser();
  const role = user?.role || 'admin';

  const visibleNav = ALL_NAV.filter(i => i.roles.includes(role));
  const visibleAdmin = ADMIN_NAV.filter(i => i.roles.includes(role));

  const NavLink = ({ label, icon: Icon, path }) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return (
      <Link
        to={path}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group',
          isActive
            ? 'bg-primary text-white shadow-sm'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
        )}
      >
        <Icon size={17} className="shrink-0" />
        <span className="font-medium text-sm">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src="https://media.base44.com/images/public/6a056f02e19305d21d34b219/fa91ede9e_BLPLogo.png"
            alt="BLP"
            className="w-9 h-9 object-contain"
          />
          <div>
            <div className="text-white text-sm font-bold leading-tight">BridgeLine Partners</div>
            <div className="text-sidebar-foreground text-xs opacity-50 mt-0.5">MIS Portal</div>
          </div>
        </div>
      </div>

      {/* User chip */}
      {user && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-sidebar-accent flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
            {(user.full_name || user.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user.full_name || user.email}</div>
            <div className="text-sidebar-foreground text-xs opacity-60 capitalize">{user.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-sidebar-foreground text-[10px] uppercase font-semibold opacity-40 px-3 pb-2 tracking-widest">Menu</div>
        {visibleNav.map(item => <NavLink key={item.path} {...item} />)}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 space-y-1">
        {visibleAdmin.map(item => <NavLink key={item.path} {...item} />)}
        <button
          onClick={() => base44.auth.logout('/login')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors text-sm font-medium"
        >
          <LogOut size={17} />
          <span>Logout</span>
        </button>
        <div className="text-sidebar-foreground text-xs opacity-30 text-center pt-2">
          © 2026 BridgeLine Partners
        </div>
      </div>
    </aside>
  );
}