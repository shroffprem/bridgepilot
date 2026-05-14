import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart2,
  Building2,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react';
// Building2 kept for MasterDirectory nav icon

const ALL_NAV = [
  { label: 'Dashboard',       icon: LayoutDashboard, path: '/',          roles: ['admin'] },
  { label: 'Cases',           icon: FileText,        path: '/loans',      roles: ['admin', 'branch_manager'] },
  { label: 'Approvals',       icon: CheckSquare,     path: '/approvals',  roles: ['admin', 'cluster_manager', 'zonal_manager'] },
  { label: 'Reports',         icon: BarChart2,       path: '/reports',    roles: ['admin'] },
  { label: 'Borrowers',       icon: Users,           path: '/borrowers',  roles: ['admin'] },
  { label: 'Master Directory',icon: Building2,       path: '/directory',  roles: ['admin'] },
];

const ADMIN_NAV = [
  { label: 'Admin', icon: ShieldCheck, path: '/admin', roles: ['admin'] },
];

export default function Sidebar() {
  const location = useLocation();
  const { user } = useCurrentUser();
  const role = user?.role || 'admin';

  const visibleNav = ALL_NAV.filter(item => item.roles.includes(role));
  const visibleAdmin = ADMIN_NAV.filter(item => item.roles.includes(role));

  const NavLink = ({ label, icon: Icon, path }) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return (
      <Link
        to={path}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
          isActive
            ? 'bg-sidebar-primary text-white'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )}
      >
        <Icon size={18} className="shrink-0" />
        <span className="font-inter font-medium text-sm flex-1">{label}</span>
        {isActive && <ChevronRight size={14} className="opacity-60" />}
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-30">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src="https://media.base44.com/images/public/6a056f02e19305d21d34b219/fa91ede9e_BLPLogo.png"
            alt="BridgeLine Partners"
            className="w-10 h-10 object-contain"
          />
          <div>
            <div className="text-white text-base leading-none font-light tracking-wide">
              <span className="font-bold">BridgeLine</span><span className="font-light">Partners</span>
            </div>
            <div className="text-sidebar-foreground text-xs mt-0.5 opacity-60">MIS Portal</div>
          </div>
        </div>
        {user && (
          <div className="mt-3 text-xs text-sidebar-foreground opacity-60 truncate">
            {user.full_name || user.email}
            <span className="ml-1 opacity-70">· {user.role?.replace('_', ' ')}</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map(item => <NavLink key={item.path} {...item} />)}
      </nav>

      {visibleAdmin.length > 0 && (
        <div className="px-3 pb-2 border-t border-sidebar-border pt-3 space-y-1">
          {visibleAdmin.map(item => <NavLink key={item.path} {...item} />)}
          <div className="text-sidebar-foreground text-xs opacity-40 text-center pt-2">
            © 2026 BridgeLine Partners
          </div>
        </div>
      )}
      {visibleAdmin.length === 0 && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="text-sidebar-foreground text-xs opacity-40 text-center">
            © 2026 BridgeLine Partners
          </div>
        </div>
      )}
    </aside>
  );
}