import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { MainNav } from '@/components/main-nav';
import Dashboard from '@/pages/dashboard';
import GoodsIn from '@/pages/goods-in';
import Picking from '@/pages/picking';
import Setup from '@/pages/setup';
import Inventory from '@/pages/inventory';
import Locations from '@/pages/locations';
import Movements from '@/pages/movements';
import { Package2 } from 'lucide-react';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="flex items-center space-x-2">
              <Package2 className="h-6 w-6" />
              <span className="font-bold">WareFlow</span>
            </div>
            <MainNav />
          </div>
        </header>
        <main className="container py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/goods-in" element={<GoodsIn />} />
            <Route path="/picking" element={<Picking />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/movements" element={<Movements />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  );
}