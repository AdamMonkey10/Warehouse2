import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getItems, updateItem } from '@/lib/firebase/items';
import { getAvailableLocations, getLocationByCode, updateLocation } from '@/lib/firebase/locations';
import { findOptimalLocation } from '@/lib/warehouse-logic';
import { subscribeToActions, updateAction } from '@/lib/firebase/actions';
import { Search, Filter, Package, QrCode, RefreshCcw, ListPlus, Truck, ArrowDownToLine, ArrowUpFromLine, MapPin } from 'lucide-react';
import { DepartmentDialog } from '@/components/department-dialog';
import type { Item } from '@/types/warehouse';
import type { WarehouseAction } from '@/lib/firebase/actions';

export default function Picking() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [actionList, setActionList] = useState<WarehouseAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeSearch, setCodeSearch] = useState('');
  const [additionalSearch, setAdditionalSearch] = useState('');
  const [additionalFilterType, setAdditionalFilterType] = useState<'description' | 'category'>('description');
  const [selectedAction, setSelectedAction] = useState<WarehouseAction | null>(null);
  const [suggestedLocations, setSuggestedLocations] = useState<Record<string, string>>({});
  const [scanDialog, setScanDialog] = useState<{
    open: boolean;
    step: 'item' | 'location';
  }>({ open: false, step: 'item' });
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  useEffect(() => {
    loadItems();
    const unsubscribe = subscribeToActions((actions) => {
      setActionList(actions);
      actions.forEach(async (action) => {
        if (action.actionType === 'in' && !suggestedLocations[action.id]) {
          try {
            const availableLocations = await getAvailableLocations(action.weight);
            const optimal = findOptimalLocation(availableLocations, action.weight);
            if (optimal) {
              setSuggestedLocations(prev => ({
                ...prev,
                [action.id]: optimal.code
              }));
            }
          } catch (error) {
            console.error('Error finding optimal location:', error);
          }
        }
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterItems();
  }, [codeSearch, additionalSearch, additionalFilterType, items]);

  const loadItems = async () => {
    try {
      const fetchedItems = await getItems();
      const placedItems = fetchedItems.filter(item => item.status === 'placed');
      setItems(placedItems);
      setFilteredItems(placedItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load items');
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    if (codeSearch.trim()) {
      const codeLower = codeSearch.toLowerCase();
      filtered = filtered.filter(item => 
        item.itemCode.toLowerCase().includes(codeLower)
      );
    }

    if (additionalSearch.trim()) {
      const searchLower = additionalSearch.toLowerCase();
      filtered = filtered.filter(item => {
        switch (additionalFilterType) {
          case 'description':
            return item.description.toLowerCase().includes(searchLower);
          case 'category':
            return item.category.toLowerCase().includes(searchLower);
          default:
            return true;
        }
      });
    }

    setFilteredItems(filtered);
  };

  const handleAddToActionList = (item: Item) => {
    setSelectedItem(item);
    setShowDepartmentDialog(true);
  };

  const handleAction = async (action: WarehouseAction) => {
    setSelectedAction(action);
    
    if (action.actionType === 'in' && !suggestedLocations[action.id]) {
      try {
        const availableLocations = await getAvailableLocations(action.weight);
        const optimal = findOptimalLocation(availableLocations, action.weight);
        if (optimal) {
          setSuggestedLocations(prev => ({
            ...prev,
            [action.id]: optimal.code
          }));
        }
      } catch (error) {
        console.error('Error finding optimal location:', error);
      }
    }
    
    setScanDialog({ open: true, step: 'item' });
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('scanInput') as HTMLInputElement;
    const scannedCode = input.value.trim();
    form.reset();

    if (!selectedAction) return;

    try {
      if (scanDialog.step === 'item') {
        if (scannedCode !== selectedAction.systemCode) {
          toast.error('Invalid barcode scanned');
          return;
        }
        setScanDialog(prev => ({ ...prev, step: 'location' }));
        const locationToScan = selectedAction.actionType === 'in' 
          ? suggestedLocations[selectedAction.id]
          : selectedAction.location;
        toast.success(`Please scan location: ${locationToScan}`);
      } else {
        const expectedLocation = selectedAction.actionType === 'in'
          ? suggestedLocations[selectedAction.id]
          : selectedAction.location;

        if (scannedCode !== expectedLocation) {
          toast.error('Invalid location code scanned');
          return;
        }

        // Get location details first
        const location = await getLocationByCode(scannedCode);
        if (!location) {
          toast.error('Location not found');
          return;
        }

        // Update location weight and status
        await updateLocation(location.id, {
          currentWeight: selectedAction.actionType === 'in' 
            ? (location.currentWeight || 0) + selectedAction.weight
            : Math.max(0, (location.currentWeight || 0) - selectedAction.weight),
          status: selectedAction.actionType === 'in'
        });

        // Update item status
        await updateItem(selectedAction.itemId, {
          status: selectedAction.actionType === 'out' ? 'removed' : 'placed',
          location: selectedAction.actionType === 'out' ? null : scannedCode,
          locationVerified: true
        });

        // Update action status
        await updateAction(selectedAction.id, {
          status: 'completed',
          location: scannedCode
        });

        toast.success(`Item ${selectedAction.actionType === 'out' ? 'picked' : 'placed'} successfully`);
        setScanDialog({ open: false, step: 'item' });
        setSelectedAction(null);
        loadItems();
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      toast.error('Failed to process scan');
    }
  };

  const getStatusColor = (action: WarehouseAction) => {
    const baseColors = {
      in: {
        pending: 'bg-blue-100 text-blue-800',
        'in-progress': 'bg-yellow-100 text-yellow-800',
        completed: 'bg-green-100 text-green-800',
      },
      out: {
        pending: 'bg-orange-100 text-orange-800',
        'in-progress': 'bg-yellow-100 text-yellow-800',
        completed: 'bg-green-100 text-green-800',
      },
    };
    return baseColors[action.actionType][action.status];
  };

  const getActionBadge = (action: WarehouseAction) => {
    const styles = action.actionType === 'in' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-orange-100 text-orange-800';
    
    return (
      <Badge variant="outline" className={styles}>
        {action.actionType === 'in' ? 'Goods In' : 'Pick'}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const styles = {
      raw: 'bg-blue-100 text-blue-800',
      finished: 'bg-green-100 text-green-800',
      packaging: 'bg-yellow-100 text-yellow-800',
      spare: 'bg-purple-100 text-purple-800',
    }[category] || 'bg-gray-100 text-gray-800';

    const labels = {
      raw: 'Raw Materials',
      finished: 'Finished Goods',
      packaging: 'Packaging',
      spare: 'Spare Parts',
    }[category] || category;

    return (
      <Badge variant="outline" className={styles}>
        {labels}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Actions</h1>
        <Button onClick={() => setLoading(true)} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Action List
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Add Items
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Current Actions
              </CardTitle>
              <CardDescription>
                Pending actions for goods in and picking ({actionList.length} items)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionList.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No pending actions. Add items from the search tab or process incoming goods.
                </div>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Time Waiting</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actionList.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell>{getActionBadge(action)}</TableCell>
                          <TableCell className="font-medium">{action.itemCode}</TableCell>
                          <TableCell>{action.description}</TableCell>
                          <TableCell>{getCategoryBadge(action.category)}</TableCell>
                          <TableCell>
                            {action.actionType === 'in' ? (
                              suggestedLocations[action.id] ? (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {suggestedLocations[action.id]}
                                </Badge>
                              ) : '—'
                            ) : (
                              action.location || '—'
                            )}
                          </TableCell>
                          <TableCell>{action.department || '—'}</TableCell>
                          <TableCell>
                            {action.timestamp?.toDate ? (
                              <span className="text-muted-foreground text-sm">
                                {formatDistanceToNow(action.timestamp.toDate(), { addSuffix: true })}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={getStatusColor(action)}
                            >
                              {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {action.status !== 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(action)}
                                className="flex items-center gap-1"
                              >
                                {action.actionType === 'in' ? (
                                  <ArrowDownToLine className="h-4 w-4" />
                                ) : (
                                  <ArrowUpFromLine className="h-4 w-4" />
                                )}
                                {action.actionType === 'in' ? 'Place' : 'Pick'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Add Items to Pick List
              </CardTitle>
              <CardDescription>
                Search and add items for picking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by item code..."
                    value={codeSearch}
                    onChange={(e) => setCodeSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Additional search..."
                      value={additionalSearch}
                      onChange={(e) => setAdditionalSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select 
                    value={additionalFilterType} 
                    onValueChange={(value: 'description' | 'category') => setAdditionalFilterType(value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="description">Description</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No items found matching your search.
                </div>
              ) : (
                <div className="border rounded-md mt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.itemCode}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{getCategoryBadge(item.category)}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>{item.weight}kg</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddToActionList(item)}
                              className="flex items-center gap-1"
                            >
                              <ListPlus className="h-4 w-4" />
                              Add to List
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={scanDialog.open} onOpenChange={(open) => !open && setScanDialog({ open: false, step: 'item' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {scanDialog.step === 'item' ? 'Scan Item' : 'Scan Location'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleScan} className="space-y-4">
            <div className="relative">
              <QrCode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                name="scanInput"
                placeholder={`Scan ${scanDialog.step} barcode...`}
                className="pl-9"
                autoComplete="off"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Verify Scan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {showDepartmentDialog && selectedItem && (
        <DepartmentDialog
          open={showDepartmentDialog}
          onOpenChange={setShowDepartmentDialog}
          item={selectedItem}
          onComplete={() => {
            setSelectedItem(null);
            loadItems();
          }}
        />
      )}
    </div>
  );
}