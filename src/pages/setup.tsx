import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { addLocation, getLocations } from '@/lib/firebase/locations';
import { LEVEL_MAX_WEIGHTS } from '@/lib/warehouse-logic';

// Warehouse structure constants
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const LOCATIONS_PER_BAY = 3;
const LEVELS = [0, 1, 2, 3, 4]; // Ground level (0) and 4 levels above

export default function Setup() {
  const [selectedRow, setSelectedRow] = useState('');
  const [bayStart, setBayStart] = useState('');
  const [bayEnd, setBayEnd] = useState('');
  const [generatedLocations, setGeneratedLocations] = useState<Array<{
    code: string;
    row: string;
    bay: string;
    level: string;
    location: string;
    maxWeight: number;
  }>>([]);
  const [existingLocations, setExistingLocations] = useState<any[]>([]);
  const [weightLimits, setWeightLimits] = useState({
    '0': LEVEL_MAX_WEIGHTS['0'],
    '1': LEVEL_MAX_WEIGHTS['1'],
    '2': LEVEL_MAX_WEIGHTS['2'],
    '3': LEVEL_MAX_WEIGHTS['3'],
    '4': LEVEL_MAX_WEIGHTS['4'],
  });

  const handleWeightChange = (level: string, value: string) => {
    const weight = parseInt(value);
    if (!isNaN(weight) && weight > 0) {
      setWeightLimits(prev => ({
        ...prev,
        [level]: weight
      }));
    }
  };

  const generateLocations = () => {
    if (!selectedRow || !bayStart || !bayEnd) {
      toast.error('Please fill in all fields');
      return;
    }

    const startBay = parseInt(bayStart);
    const endBay = parseInt(bayEnd);

    if (startBay > endBay) {
      toast.error('Start bay must be less than or equal to end bay');
      return;
    }

    const locations = [];
    for (let bay = startBay; bay <= endBay; bay++) {
      for (let position = 1; position <= LOCATIONS_PER_BAY; position++) {
        for (const level of LEVELS) {
          const bayFormatted = bay.toString().padStart(2, '0');
          const code = `${selectedRow}${bayFormatted}-${level}-${position}`;
          locations.push({
            code,
            row: selectedRow,
            bay: bayFormatted,
            level: level.toString(),
            location: position.toString(),
            maxWeight: weightLimits[level.toString()],
            currentWeight: 0,
            available: true,
            verified: true
          });
        }
      }
    }

    setGeneratedLocations(locations);
  };

  const saveLocations = async () => {
    try {
      const savedLocations = [];
      for (const location of generatedLocations) {
        const locationId = await addLocation(location);
        savedLocations.push({ id: locationId, ...location });
      }
      toast.success(`${savedLocations.length} locations saved successfully`);
      setGeneratedLocations([]);
      fetchExistingLocations();
    } catch (error) {
      console.error('Error saving locations:', error);
      toast.error('Error saving locations');
    }
  };

  const fetchExistingLocations = async () => {
    try {
      const locations = await getLocations();
      setExistingLocations(locations);
      toast.success(`Found ${locations.length} existing locations`);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Error fetching existing locations');
    }
  };

  const getWeightStatusColor = (currentWeight: number, maxWeight: number) => {
    if (!currentWeight) return 'text-green-600';
    if (currentWeight >= maxWeight * 0.9) return 'text-red-600';
    if (currentWeight >= maxWeight * 0.7) return 'text-yellow-600';
    return 'text-blue-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Setup</h1>
        <Button onClick={fetchExistingLocations}>
          Refresh Locations
        </Button>
      </div>

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="weights">Weight Settings</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="weights">
          <Card>
            <CardHeader>
              <CardTitle>Level Weight Settings</CardTitle>
              <CardDescription>
                Configure maximum weight limits for each level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {LEVELS.map((level) => (
                  <div key={level} className="flex items-center gap-4">
                    <Label className="w-32">
                      Level {level}
                      {level === 0 && ' (Ground)'}:
                    </Label>
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={weightLimits[level.toString()]}
                        onChange={(e) => handleWeightChange(level.toString(), e.target.value)}
                        min="0"
                        step="100"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8">kg</span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground mt-4">
                  Note: Changes will apply to newly generated locations only
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Locations</CardTitle>
              <CardDescription>
                Generate warehouse locations based on row and bay range. Each bay has {LOCATIONS_PER_BAY} locations and {LEVELS.length} levels (0-4).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Row</Label>
                  <Select value={selectedRow} onValueChange={setSelectedRow}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select row" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROWS.map((row) => (
                        <SelectItem key={row} value={row}>
                          Row {row}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start Bay</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bayStart}
                    onChange={(e) => setBayStart(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Bay</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bayEnd}
                    onChange={(e) => setBayEnd(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                <p>Location Format: ROW-BAY-LEVEL-LOCATION</p>
                <p>Example: A01-0-1 (Row A, Bay 1, Ground Level, Location 1)</p>
                <p className="mt-2">Weight Limits per Level:</p>
                <ul className="list-disc list-inside">
                  {Object.entries(weightLimits).map(([level, weight]) => (
                    <li key={level}>
                      Level {level}: {weight}kg
                    </li>
                  ))}
                </ul>
              </div>
              <Button onClick={generateLocations} className="w-full">
                Generate Locations
              </Button>
            </CardContent>
          </Card>

          {generatedLocations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Locations</CardTitle>
                <CardDescription>
                  Review and save the generated locations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location Code</TableHead>
                        <TableHead>Row</TableHead>
                        <TableHead>Bay</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Max Weight</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generatedLocations.map((location) => (
                        <TableRow key={location.code}>
                          <TableCell className="font-medium">
                            {location.code}
                          </TableCell>
                          <TableCell>{location.row}</TableCell>
                          <TableCell>{location.bay}</TableCell>
                          <TableCell>{location.level === '0' ? 'Ground' : location.level}</TableCell>
                          <TableCell>{location.location}</TableCell>
                          <TableCell>{location.maxWeight}kg</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button
                  onClick={saveLocations}
                  className="w-full mt-4"
                  variant="default"
                >
                  Save All Locations
                </Button>
              </CardContent>
            </Card>
          )}

          {existingLocations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Existing Locations</CardTitle>
                <CardDescription>
                  Currently configured warehouse locations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location Code</TableHead>
                        <TableHead>Row</TableHead>
                        <TableHead>Bay</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Weight Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingLocations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell className="font-medium">
                            {location.code}
                          </TableCell>
                          <TableCell>{location.row}</TableCell>
                          <TableCell>{location.bay}</TableCell>
                          <TableCell>{location.level === '0' ? 'Ground' : location.level}</TableCell>
                          <TableCell>{location.location}</TableCell>
                          <TableCell>
                            <span className={getWeightStatusColor(location.currentWeight, location.maxWeight)}>
                              {location.currentWeight}/{location.maxWeight}kg
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Item Categories</CardTitle>
              <CardDescription>
                Manage product categories and classifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Category management coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage warehouse staff and their permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                User management coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}