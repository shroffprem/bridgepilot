import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboard, FileText, BarChart2, CheckSquare, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BOTTOM_NAV = [
  { label: 'Home',      icon: LayoutDashboard, path: '/',          roles: ['admin'] },
  { label: 'Cases',     icon: FileText,        path: '/loans',     roles: ['admin', 'branch_manager'] },
  { label: 'Approvals', icon: CheckSquare,     path: '/approvals', roles: ['admin', 'cluster_manager', 'zonal_manager'] },
  { label: 'Reports',   icon: BarChart2,       path: '/reports',   roles: ['admin'] },
  { label: 'Admin',     icon: ShieldCheck,     path: '/admin',     roles: ['admin'] },
];

export default function AppLayout() {
  const location = useLocation();
  const { user } = useCurrentUser();
  const role = user?.role || 'admin';
  const visibleBottom = BOTTOM_NAV.filter(i => i.roles.includes(role));

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-14 bg-card border-b border-border flex items-center px-4 lg:px-6 sticky top-0 z-20 gap-3">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <img
              src="https://media.base44.com/images/public/6a056f02e19305d21d34b219/fa91ede9e_BLPLogo.png"
              alt="BLP"
              className="w-7 h-7 object-contain"
            />
            <span className="font-bold text-sm text-foreground">BridgeLine</span>
          </div>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                {(user.full_name || user.email || '?')[0].toUpperCase()}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-foreground leading-tight">{user.full_name || user.email}</div>
                <div className="text-xs text-muted-foreground capitalize">{user.role?.replace(/_/g, ' ')}</div>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border">
        <div className="flex items-center justify-around">
          {visibleBottom.map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link key={path} to={path} className="flex flex-col items-center py-2 px-3 flex-1">
                <Icon size={20} className={cn(isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-[10px] mt-0.5 font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}