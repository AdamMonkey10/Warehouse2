import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addItem } from '@/lib/firebase/items';
import { createGoodsInAction } from '@/lib/firebase/actions';
import { getAvailableLocations } from '@/lib/firebase/locations';
import { findOptimalLocation } from '@/lib/warehouse-logic';
import { generateItemCode } from '@/lib/utils';
import { addMovement } from '@/lib/firebase/movements';
import { Barcode as BarcodeIcon, Printer, ArrowRight, MapPin } from 'lucide-react';
import { Barcode } from '@/components/barcode';
import { useNavigate } from 'react-router-dom';

export default function GoodsIn() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    itemCode: '',
    description: '',
    weight: '',
    category: '',
    coilNumber: '',
    coilLength: '', // in feet
  });
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [suggestedLocation, setSuggestedLocation] = useState<string | null>(null);

  const isRawMaterial = formData.category === 'raw';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const systemCode = generateItemCode(formData.category, Date.now());
      setGeneratedCode(systemCode);

      const description = isRawMaterial
        ? `Coil: ${formData.coilNumber}, Length: ${formData.coilLength}ft`
        : formData.description;

      const metadata = isRawMaterial
        ? {
            coilNumber: formData.coilNumber,
            coilLength: formData.coilLength,
          }
        : undefined;

      // Add the item
      const itemData = {
        itemCode: formData.itemCode,
        systemCode,
        description,
        weight: parseFloat(formData.weight),
        category: formData.category,
        status: 'pending',
        metadata,
      };

      const itemId = await addItem(itemData);

      if (!itemId) {
        throw new Error('Failed to create item');
      }

      // Find optimal location
      const availableLocations = await getAvailableLocations(parseFloat(formData.weight));
      const optimalLocation = findOptimalLocation(availableLocations, parseFloat(formData.weight));
      if (optimalLocation) {
        setSuggestedLocation(optimalLocation.code);
      }

      // Create goods-in action
      await createGoodsInAction({
        ...itemData,
        id: itemId,
      });

      // Record the movement
      await addMovement({
        itemId,
        type: 'IN',
        weight: parseFloat(formData.weight),
        operator: 'System', // You might want to add user authentication and use the actual operator name
        reference: formData.itemCode,
        notes: `Goods in: ${description}`
      });

      toast.success(`${isRawMaterial ? 'Raw material' : 'Item'} added to warehouse actions`);
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('Failed to save item');
      setGeneratedCode('');
      setSuggestedLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Barcode</title>
            <style>
              body { margin: 20px; }
              .barcode-container { text-align: center; }
              .item-details { 
                margin-top: 20px; 
                font-family: Arial;
                text-align: center;
              }
              .code {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .details {
                font-size: 16px;
                color: #666;
              }
              .location {
                margin-top: 15px;
                padding: 10px;
                background: #f0f9ff;
                border-radius: 4px;
                color: #0369a1;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="barcode-container">
              ${document.getElementById('barcode-svg')?.outerHTML}
            </div>
            <div class="item-details">
              <div class="code">${generatedCode}</div>
              <div class="details">
                <p><strong>Reference:</strong> ${formData.itemCode}</p>
                ${isRawMaterial ? `
                <p><strong>Coil:</strong> ${formData.coilNumber}</p>
                <p><strong>Length:</strong> ${formData.coilLength}ft</p>
                ` : `
                <p><strong>Description:</strong> ${formData.description}</p>
                `}
                <p><strong>Weight:</strong> ${formData.weight}kg</p>
                ${suggestedLocation ? `
                <div class="location">
                  <p>Suggested Location: ${suggestedLocation}</p>
                </div>
                ` : ''}
              </div>
            </div>
            <script>window.onload = () => window.print()</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleViewActions = () => {
    navigate('/picking');
  };

  const handleReset = () => {
    setFormData({
      itemCode: '',
      description: '',
      weight: '',
      category: '',
      coilNumber: '',
      coilLength: '',
    });
    setGeneratedCode('');
    setSuggestedLocation(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Goods In</h1>
        <Button variant="outline" onClick={handleViewActions}>
          View Warehouse Actions
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {generatedCode && (
        <Card className="bg-primary/5 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarcodeIcon className="h-5 w-5" />
              Generated Barcode
            </CardTitle>
            <CardDescription>
              Print this barcode and attach it to the {isRawMaterial ? 'raw material' : 'item'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <Barcode value={generatedCode} className="w-full max-w-md" />
              <div className="text-center">
                <div className="text-lg font-bold">{generatedCode}</div>
                <div className="text-sm text-muted-foreground">
                  Reference: {formData.itemCode}
                </div>
                {isRawMaterial && (
                  <div className="text-sm text-muted-foreground">
                    Coil: {formData.coilNumber}, Length: {formData.coilLength}ft
                  </div>
                )}
                {suggestedLocation && (
                  <div className="mt-2">
                    <Badge variant="secondary" className="flex items-center gap-1 text-base">
                      <MapPin className="h-4 w-4" />
                      Suggested Location: {suggestedLocation}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Barcode
                </Button>
                <Button onClick={handleReset} variant="default">
                  Process Next {isRawMaterial ? 'Material' : 'Item'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {isRawMaterial ? 'Material' : 'Item'} has been added to the warehouse actions list.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!generatedCode && (
        <Card>
          <CardHeader>
            <CardTitle>Receive Items</CardTitle>
            <CardDescription>
              Enter the details of the items being received.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemCode">Reference Code</Label>
                  <Input
                    id="itemCode"
                    placeholder="Enter reference code"
                    value={formData.itemCode}
                    onChange={(e) =>
                      setFormData({ ...formData, itemCode: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">Raw Materials</SelectItem>
                      <SelectItem value="finished">Finished Goods</SelectItem>
                      <SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="spare">Spare Parts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isRawMaterial ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="coilNumber">Number of Coils</Label>
                      <Input
                        id="coilNumber"
                        type="number"
                        min="1"
                        placeholder="Enter number of coils"
                        value={formData.coilNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, coilNumber: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="coilLength">Length (ft)</Label>
                      <Input
                        id="coilLength"
                        type="number"
                        step="0.1"
                        placeholder="Enter length in feet"
                        value={formData.coilLength}
                        onChange={(e) =>
                          setFormData({ ...formData, coilLength: e.target.value })
                        }
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter item description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    placeholder="Enter weight"
                    value={formData.weight}
                    onChange={(e) =>
                      setFormData({ ...formData, weight: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving...' : 'Generate Barcode'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}