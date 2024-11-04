import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Warehouse, Clock } from 'lucide-react';
import { getItems } from '@/lib/firebase/items';
import { getLocations } from '@/lib/firebase/locations';
import { getPendingActions } from '@/lib/firebase/actions';
import { ThemeToggle } from '@/components/theme-toggle';
import type { Item, Location } from '@/types/warehouse';
import type { WarehouseAction } from '@/lib/firebase/actions';

interface LocationStats {
  total: number;
  empty: number;
  occupied: number;
  occupancyRate: number;
}

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStats>({
    total: 0,
    empty: 0,
    occupied: 0,
    occupancyRate: 0
  });
  const [pendingActions, setPendingActions] = useState<WarehouseAction[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedItems, fetchedLocations, fetchedActions] = await Promise.all([
          getItems(),
          getLocations(),
          getPendingActions()
        ]);

        setItems(fetchedItems);
        setPendingActions(fetchedActions);

        // Calculate location statistics
        const stats = fetchedLocations.reduce((acc, location) => {
          acc.total++;
          if (location.currentWeight === 0) {
            acc.empty++;
          } else {
            acc.occupied++;
          }
          return acc;
        }, { total: 0, empty: 0, occupied: 0 });

        setLocationStats({
          ...stats,
          occupancyRate: (stats.occupied / stats.total) * 100
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
  }, []);

  // Get counts
  const placedItems = items.filter(item => item.status === 'placed').length;
  const pendingTasks = pendingActions.length;
  const incomingItems = pendingActions.filter(a => a.actionType === 'in').length;
  const pickingTasks = pendingActions.filter(a => a.actionType === 'out').length;

  // Group picking tasks by department
  const departmentTasks = pendingActions
    .filter(a => a.actionType === 'out')
    .reduce((acc, action) => {
      const dept = action.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="relative space-y-6 min-h-[calc(100vh-4rem)]">
      {/* Background Logo */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] dark:opacity-[0.02] -z-10">
        <svg className="w-full max-w-7xl" viewBox="0 0 128.7 58.3" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path d="m26.7 15.5v-6.4c0-.7-.4-1.1-1.2-1.3h6.3c2 0 3.7.2 5.2.6 1.4.4 2.5.9 3.2 1.6s1.1 1.5 1.1 2.4c-.1.8-.4 1.5-1.2 2.1-.7.7-1.8 1.2-3.2 1.6s-3.2.6-5.4.6h-6v-.1c.8 0 1.2-.5 1.2-1.1zm84.2 11.8c0-.6.3-1 .9-1.4s1.3-.6 2.2-.8 2-.3 3.1-.3 2.3.1 3.5.3v1.6c-.5-.3-1.2-.5-1.8-.7-.7-.2-1.4-.2-2.1-.2s-1.4.1-2 .3c-.5.2-.9.4-1 .7 0 .1-.1.2-.1.3 0 .4.3.8.9 1 .6.3 1.4.5 2.4.8l2 .6c.8.2 1.5.5 2.1.9s.9.9.9 1.4c-.1.6-.4 1.1-1 1.5s-1.4.8-2.4 1-2.2.4-3.4.4-2.6-.1-4-.4l-.7-1.8c.8.4 1.6.7 2.5.9s1.8.3 2.6.3c1 0 1.8-.2 2.6-.4s1.2-.6 1.2-1.1c0-.7-.8-1.2-2.4-1.6l-2.8-.8c-.5-.2-1-.3-1.5-.6-.5-.2-.9-.5-1.2-.8s-.5-.7-.5-1.1z" />
        </svg>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <ThemeToggle />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/inventory" className="transition-transform hover:scale-[1.02]">
          <Card className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{placedItems}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Items in warehouse
              </div>
              <div className="h-1 w-full bg-muted mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all" 
                  style={{ width: `${Math.min(100, (placedItems / 1000) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/locations" className="transition-transform hover:scale-[1.02]">
          <Card className="hover:bg-blue-500/5 dark:hover:bg-blue-500/10 transition-colors border-2 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Location Status</CardTitle>
              <Warehouse className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {Math.round(locationStats.occupancyRate)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {locationStats.occupied} Used / {locationStats.empty} Empty
              </div>
              <div className="h-1 w-full bg-muted mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all" 
                  style={{ width: `${locationStats.occupancyRate}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/picking" className="transition-transform hover:scale-[1.02]">
          <Card className="hover:bg-yellow-500/5 dark:hover:bg-yellow-500/10 transition-colors border-2 border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {pendingTasks}
              </div>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">{pickingTasks}</span> picks
                  {incomingItems > 0 && (
                    <> / <span className="font-medium">{incomingItems}</span> placements</>
                  )}
                </div>
                {Object.entries(departmentTasks).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {Object.entries(departmentTasks).map(([dept, count]) => (
                      <div key={dept} className="flex justify-between">
                        <span>{dept}:</span>
                        <span className="font-medium">{count} items</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-1 w-full bg-muted mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all" 
                  style={{ 
                    width: `${Math.min(100, (pendingTasks / 50) * 100)}%` 
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}