import { useLocation } from 'react-router-dom';
import { Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const pageTitles = {
  '/': 'Dashboard',
  '/loans': 'Cases',
  '/loans/new': 'New Case',
  '/reports': 'Reports',
  '/borrowers': 'Borrowers',
  '/directory': 'Master Directory',
};

export default function TopBar() {
  const location = useLocation();
  const title = Object.entries(pageTitles).reverse().find(([path]) => location.pathname.startsWith(path))?.[1] || 'BridgeLine Partners';

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      <h1 className="font-syne font-bold text-xl text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell size={18} />
        </Button>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User size={14} className="text-primary-foreground" />
        </div>
      </div>
    </header>
  );
}