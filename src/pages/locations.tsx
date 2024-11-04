import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getLocations } from '@/lib/firebase/locations';
import { Grid2X2, Search, Filter, QrCode, RefreshCcw, Printer, Grid } from 'lucide-react';
import { Barcode } from '@/components/barcode';
import type { Location } from '@/types/warehouse';

interface BayGroup {
  id: string;
  row: string;
  bay: string;
  locations: Location[];
  totalWeight: number;
  maxWeight: number;
  levelWeights: Record<string, { current: number; max: number }>;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [bays, setBays] = useState<BayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'code' | 'row' | 'bay' | 'level'>('code');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    filterLocations();
  }, [search, filterType, locations]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const fetchedLocations = await getLocations();
      setLocations(fetchedLocations);
      setFilteredLocations(fetchedLocations);
      
      // Group locations by bay
      const bayGroups = fetchedLocations.reduce((groups: Record<string, BayGroup>, loc) => {
        const bayId = `${loc.row}${loc.bay}`;
        if (!groups[bayId]) {
          groups[bayId] = {
            id: bayId,
            row: loc.row,
            bay: loc.bay,
            locations: [],
            totalWeight: 0,
            maxWeight: 0,
            levelWeights: {},
          };
        }
        groups[bayId].locations.push(loc);
        groups[bayId].totalWeight += loc.currentWeight;
        groups[bayId].maxWeight += loc.maxWeight;

        // Track weights by level
        if (!groups[bayId].levelWeights[loc.level]) {
          groups[bayId].levelWeights[loc.level] = { current: 0, max: 1500 }; // Default max weight per level
        }
        groups[bayId].levelWeights[loc.level].current += loc.currentWeight;

        return groups;
      }, {});

      setBays(Object.values(bayGroups).sort((a, b) => {
        const rowCompare = a.row.localeCompare(b.row);
        if (rowCompare !== 0) return rowCompare;
        return a.bay.localeCompare(b.bay);
      }));
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const filterLocations = () => {
    if (!search.trim()) {
      setFilteredLocations(locations);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = locations.filter(location => {
      switch (filterType) {
        case 'code':
          return location.code.toLowerCase().includes(searchLower);
        case 'row':
          return location.row.toLowerCase().includes(searchLower);
        case 'bay':
          return location.bay.toLowerCase().includes(searchLower);
        case 'level':
          return location.level.toLowerCase().includes(searchLower);
        default:
          return false;
      }
    });

    setFilteredLocations(filtered);
  };

  const handlePrint = () => {
    if (!selectedLocation) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Location Barcode</title>
            <style>
              body { margin: 20px; }
              .barcode-container { text-align: center; }
              .location-details { 
                margin-top: 20px; 
                font-family: Arial; 
                text-align: center;
              }
              .location-code {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .weight-limit {
                font-size: 16px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="barcode-container">
              ${document.getElementById('barcode-svg')?.outerHTML}
            </div>
            <div class="location-details">
              <div class="location-code">${selectedLocation.code}</div>
              <div class="weight-limit">Max Weight: ${selectedLocation.maxWeight}kg</div>
            </div>
            <script>window.onload = () => window.print()</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const getWeightStatusColor = (currentWeight: number, maxWeight: number) => {
    const ratio = currentWeight / maxWeight;
    if (ratio === 0) return 'bg-green-100 text-green-800';
    if (ratio >= 0.9) return 'bg-red-100 text-red-800';
    if (ratio >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getWeightStatusText = (currentWeight: number, maxWeight: number) => {
    const ratio = currentWeight / maxWeight;
    if (ratio === 0) return 'Empty';
    if (ratio >= 0.9) return 'Full';
    if (ratio >= 0.7) return 'Heavy';
    if (currentWeight > 0) return 'Full';
    return 'Available';
  };

  const renderBayGrid = (bay: BayGroup) => {
    // Sort locations by level (descending) and then by location number
    const sortedLocations = [...bay.locations].sort((a, b) => {
      const levelDiff = parseInt(b.level) - parseInt(a.level);
      if (levelDiff !== 0) return levelDiff;
      return parseInt(a.location) - parseInt(b.location);
    });

    // Group locations by level
    const locationsByLevel = sortedLocations.reduce((acc, loc) => {
      if (!acc[loc.level]) acc[loc.level] = [];
      acc[loc.level].push(loc);
      return acc;
    }, {} as Record<string, Location[]>);

    // Sort levels in descending order (4 to 0)
    const sortedLevels = Object.keys(locationsByLevel).sort((a, b) => Number(b) - Number(a));

    return (
      <div key={bay.id} className="p-4 border rounded-lg">
        <div className="mb-2 flex justify-between items-center">
          <h3 className="font-semibold text-foreground">
            Row {bay.row} - Bay {bay.bay}
          </h3>
          <Badge 
            variant="outline" 
            className={getWeightStatusColor(bay.totalWeight, bay.maxWeight)}
          >
            {Math.round((bay.totalWeight / bay.maxWeight) * 100)}% Full
          </Badge>
        </div>
        <div className="space-y-4">
          {sortedLevels.map(level => (
            <div key={level} className="space-y-2">
              <div className="flex justify-between items-center text-sm text-foreground">
                <span>Level {level}</span>
                <span>{bay.levelWeights[level].current}/{bay.levelWeights[level].max}kg</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {locationsByLevel[level].map((location) => (
                  <div
                    key={location.code}
                    className={`p-2 border rounded text-sm ${
                      getWeightStatusColor(location.currentWeight, location.maxWeight)
                    }`}
                  >
                    <div className="font-medium">{location.code}</div>
                    <div className="text-xs">
                      {location.currentWeight}/{location.maxWeight}kg
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Locations</h1>
        <Button onClick={loadLocations} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <Grid2X2 className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="bays" className="flex items-center gap-2">
            <Grid className="h-4 w-4" />
            Bays
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid2X2 className="h-5 w-5" />
                Location List
              </CardTitle>
              <CardDescription>
                View and manage individual storage locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search locations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">Location Code</SelectItem>
                    <SelectItem value="row">Row</SelectItem>
                    <SelectItem value="bay">Bay</SelectItem>
                    <SelectItem value="level">Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading locations...
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No locations found matching your search.
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Row</TableHead>
                        <TableHead>Bay</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Weight Status</TableHead>
                        <TableHead>Max Weight</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLocations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell className="font-medium">{location.code}</TableCell>
                          <TableCell>{location.row}</TableCell>
                          <TableCell>{location.bay}</TableCell>
                          <TableCell>{location.level}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={getWeightStatusColor(location.currentWeight, location.maxWeight)}
                            >
                              {getWeightStatusText(location.currentWeight, location.maxWeight)}
                              {location.currentWeight > 0 && ` (${location.currentWeight}kg)`}
                            </Badge>
                          </TableCell>
                          <TableCell>{location.maxWeight}kg</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLocation(location);
                                setShowBarcodeDialog(true);
                              }}
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              Barcode
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

        <TabsContent value="bays">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid className="h-5 w-5" />
                Bay Overview
              </CardTitle>
              <CardDescription>
                Visual representation of warehouse bays and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading bays...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bays.map(bay => renderBayGrid(bay))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Location Barcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              {selectedLocation && (
                <>
                  <Barcode value={selectedLocation.code} className="w-full max-w-md" />
                  <div className="text-center">
                    <div className="text-lg font-bold">{selectedLocation.code}</div>
                    <div className="text-sm text-muted-foreground">
                      Max Weight: {selectedLocation.maxWeight}kg
                    </div>
                  </div>
                  <Button onClick={handlePrint} className="w-full">
                    <Printer className="h-4 w-4 mr-2" />
                    Print Barcode
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}