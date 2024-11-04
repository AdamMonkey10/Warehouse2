import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  PackageSearch, 
  PackagePlus, 
  Settings, 
  LayoutDashboard, 
  Grid2X2,
  ArrowDownUp
} from 'lucide-react';

const routes = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Goods In',
    href: '/goods-in',
    icon: PackagePlus,
  },
  {
    title: 'Actions',
    href: '/picking',
    icon: PackageSearch,
  },
  {
    title: 'Locations',
    href: '/locations',
    icon: Grid2X2,
  },
  {
    title: 'Movements',
    href: '/movements',
    icon: ArrowDownUp,
  },
  {
    title: 'Setup',
    href: '/setup',
    icon: Settings,
  },
];

export function MainNav() {
  const location = useLocation();

  return (
    <nav className="ml-6 flex items-center space-x-4 lg:space-x-6">
      {routes.map((route) => {
        const Icon = route.icon;
        return (
          <Button
            key={route.href}
            variant="ghost"
            asChild
            className={cn(
              'justify-start',
              location.pathname === route.href &&
                'bg-muted font-medium text-primary'
            )}
          >
            <Link to={route.href} className="flex items-center space-x-2">
              <Icon className="h-4 w-4" />
              <span>{route.title}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}