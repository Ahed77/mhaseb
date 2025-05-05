
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Barcode, PlusCircle, Printer, Share2, Trash2, Edit, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { arEG } from 'date-fns/locale'; // Import Arabic locale for date formatting
import { format } from 'date-fns'; // Import date-fns

// Mock data structure for a product
interface Product {
  id: string;
  barcode: string;
  name: string;
  quantity: number;
  price: number;
}

// Helper function to load data from localStorage safely
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    if (typeof window === 'undefined') return defaultValue; // Guard against server-side execution
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue === null || storedValue === 'undefined') {
            return defaultValue;
        }
        return JSON.parse(storedValue);
    } catch (error) {
        console.error(`Error loading or parsing ${key} from localStorage:`, error);
         try {
             localStorage.removeItem(key);
         } catch (removeError) {
             console.error(`Error removing corrupted key ${key} from localStorage:`, removeError);
         }
        return defaultValue;
    }
};

export default function InventoryPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for adding/editing products
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');

  // Ref for barcode input focus
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load products from local storage on mount
  useEffect(() => {
    const storedProducts = localStorage.getItem('inventoryProducts');
    if (storedProducts) {
       try {
         const parsedProducts = JSON.parse(storedProducts);
         setProducts(parsedProducts);
         setFilteredProducts(parsedProducts); // Initialize filtered list
       } catch (error) {
            console.error("Error parsing inventory products from localStorage:", error);
            localStorage.removeItem('inventoryProducts'); // Clear corrupted data
            setProducts([]);
            setFilteredProducts([]);
       }
    }
  }, []);

  // Save products to local storage whenever products state changes
  useEffect(() => {
    // Only save if products is not the initial empty array (to avoid overwriting on first load if storage was empty)
    if (products.length > 0 || localStorage.getItem('inventoryProducts') !== null) {
         localStorage.setItem('inventoryProducts', JSON.stringify(products));
    }
  }, [products]);

  // Filter products based on search term
   useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    setFilteredProducts(
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
          product.barcode.includes(lowerCaseSearchTerm)
      )
    );
   }, [searchTerm, products]); // Filter whenever search term or products change


  // --- Handlers ---

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || !productName || quantity === '' || price === '' || Number(quantity) < 0 || Number(price) < 0) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول بقيم صحيحة وموجبة.",
        variant: "destructive",
      });
      return;
    }

     // Check for duplicate barcode or name (optional but good practice)
    if (products.some(p => p.barcode === barcode)) {
        toast({ title: "خطأ", description: "الباركود موجود بالفعل.", variant: "destructive"});
        return;
    }
    // if (products.some(p => p.name.toLowerCase() === productName.trim().toLowerCase())) {
    //     toast({ title: "خطأ", description: "اسم المنتج موجود بالفعل.", variant: "destructive"});
    //     return;
    // }


    const newProduct: Product = {
      id: `prod-${Date.now()}`, // More robust ID
      barcode: barcode.trim(),
      name: productName.trim(),
      quantity: Number(quantity),
      price: Number(price),
    };

    setProducts(prevProducts => [...prevProducts, newProduct]); // State update triggers save useEffect
    resetForm();
    setIsAddDialogOpen(false);
    toast({
      title: "نجاح",
      description: "تمت إضافة المنتج بنجاح.",
    });
  };

  const handleEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || !barcode || !productName || quantity === '' || price === '' || Number(quantity) < 0 || Number(price) < 0) {
       toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول بقيم صحيحة وموجبة.",
        variant: "destructive",
      });
      return;
    }

     // Check for duplicate barcode or name (excluding the current product being edited)
    if (products.some(p => p.id !== currentProduct.id && p.barcode === barcode.trim())) {
        toast({ title: "خطأ", description: "الباركود موجود بالفعل لمنتج آخر.", variant: "destructive"});
        return;
    }
    // if (products.some(p => p.id !== currentProduct.id && p.name.toLowerCase() === productName.trim().toLowerCase())) {
    //     toast({ title: "خطأ", description: "اسم المنتج موجود بالفعل لمنتج آخر.", variant: "destructive"});
    //     return;
    // }


    setProducts(
      products.map((p) =>
        p.id === currentProduct.id
          ? { ...p, barcode: barcode.trim(), name: productName.trim(), quantity: Number(quantity), price: Number(price) }
          : p
      )
    ); // State update triggers save useEffect
    resetForm();
    setIsEditDialogOpen(false);
    setCurrentProduct(null);
     toast({
      title: "نجاح",
      description: "تم تعديل المنتج بنجاح.",
    });
  };

  const handleDeleteProduct = (id: string) => {
     // Add confirmation dialog here if desired
    setProducts(products.filter((p) => p.id !== id)); // State update triggers save useEffect
     toast({
      title: "نجاح",
      description: "تم حذف المنتج.",
       variant: "destructive", // Use destructive variant for delete confirmation
    });
  };

  const openEditDialog = (product: Product) => {
    setCurrentProduct(product);
    setBarcode(product.barcode);
    setProductName(product.name);
    setQuantity(product.quantity);
    setPrice(product.price);
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setBarcode('');
    setProductName('');
    setQuantity('');
    setPrice('');
  };

  const handleScanBarcode = () => {
    // In a real app, this would trigger the device's camera for barcode scanning.
    // For this example, we'll simulate scanning a barcode.
    const randomBarcode = `SCAN${Math.floor(1000 + Math.random() * 9000)}`;
    setBarcode(randomBarcode);
    toast({
      title: "تم المسح",
      description: `تمت قراءة الباركود: ${randomBarcode}`,
    });
    // Optionally focus the next input field
    // productNameInputRef.current?.focus();
  };

   const handlePrintInventory = () => {
    if (filteredProducts.length === 0) {
         toast({ title: "لا يمكن الطباعة", description: "لا توجد منتجات لعرضها في التقرير.", variant: "destructive" });
         return;
    }
    const businessName = loadFromLocalStorage<string>('businessName', 'Easy Inventory'); // Load business name
    const businessPhone = loadFromLocalStorage<string>('businessPhone', ''); // Load business phone
    const printDate = format(new Date(), 'yyyy/MM/dd HH:mm', { locale: arEG }); // Format date

    // Basic print functionality
    const printContent = `
      <html>
        <head>
          <title>جرد المخزن</title>
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10pt; } /* Adjusted font size */
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; } /* Adjusted padding */
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            h1 { text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; font-size: 16pt;}
            .print-header { text-align: center; margin-bottom: 25px; font-size: 12pt; color: #333; }
            .print-header p { margin: 2px 0; font-size: 10pt; color: #666; }
            .print-footer { text-align: center; margin-top: 30px; font-size: 9pt; color: #666; border-top: 1px solid #eee; padding-top: 10px;}
            .total-row td { font-weight: bold; border-top: 2px solid #333; }
            .total-label { text-align: left; }
             @page { size: A4; margin: 1.5cm; } /* Control print margins */
             @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } /* Ensure colors print */
                .no-print { display: none; } /* Hide elements in print */
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${businessName}</h1>
            ${businessPhone ? `<p>${businessPhone}</p>` : ''}
             <p>تقرير جرد المخزن - ${printDate}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>باركود</th>
                <th>اسم المنتج</th>
                <th style="text-align: center;">الكمية</th>
                <th style="text-align: right;">سعر الوحدة</th>
                 <th style="text-align: right;">القيمة الإجمالية</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts
                .map(
                  (p) => `
                <tr>
                  <td>${p.barcode}</td>
                  <td>${p.name}</td>
                  <td style="text-align: center;">${p.quantity}</td>
                  <td style="text-align: right;">${p.price.toFixed(2)}</td>
                   <td style="text-align: right;">${(p.quantity * p.price).toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
             <tfoot>
                <tr class="total-row">
                    <td colspan="4" class="total-label">إجمالي قيمة المخزون:</td>
                    <td style="text-align: right;">
                        ${filteredProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0).toFixed(2)}
                    </td>
                </tr>
            </tfoot>
          </table>
          <div class="print-footer">
            نهاية التقرير
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
         // Delay print slightly to ensure rendering
         setTimeout(() => {
            try {
                printWindow.print();
                // Keep window open for viewing or saving as PDF
                // printWindow.close();
            } catch (error) {
                console.error("Print error:", error);
                 toast({ title: "خطأ", description: "فشل بدء عملية الطباعة.", variant: "destructive" });
                 printWindow.close(); // Close on error
            }
        }, 500); // Increased delay slightly
        toast({ title: "تم", description: "يتم تحضير التقرير للطباعة." });
    } else {
        toast({ title: "خطأ", description: "فشل فتح نافذة الطباعة. تحقق من مانع النوافذ المنبثقة.", variant: "destructive" });
    }
  };

  const handleShareInventory = () => {
     if (filteredProducts.length === 0) {
         toast({ title: "لا يمكن المشاركة", description: "لا توجد منتجات لمشاركتها.", variant: "destructive" });
         return;
    }
     const businessName = loadFromLocalStorage<string>('businessName', 'Easy Inventory'); // Load business name
     const printDate = format(new Date(), 'yyyy/MM/dd HH:mm', { locale: arEG }); // Format date

    // Basic share functionality using Web Share API if available
     const totalValue = filteredProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0).toFixed(2);
    const shareText = `${businessName} - جرد المخزن (${printDate}):\n` +
        `--------------------\n` +
        filteredProducts
        .map((p) => `${p.name} (الكمية: ${p.quantity}, السعر: ${p.price.toFixed(2)}, الإجمالي: ${(p.quantity * p.price).toFixed(2)})`)
        .join('\n') +
        `\n--------------------\n` +
        `إجمالي قيمة المخزون: ${totalValue}`;


    if (navigator.share) {
      navigator.share({
        title: 'جرد المخزن',
        text: shareText,
      })
      .then(() => toast({ title: "نجاح", description: "تمت مشاركة جرد المخزن." }))
      .catch((error) => {
          console.error("Share error:", error);
          // Handle specific errors like AbortError
          if (error.name !== 'AbortError') {
            toast({ title: "خطأ", description: `لم تتم المشاركة: ${error.message || error}`, variant: 'destructive' });
          } else {
            // User likely cancelled the share sheet
             toast({ title: "إلغاء", description: "تم إلغاء المشاركة.", variant: "default" });
          }
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(shareText)
        .then(() => toast({ title: "تم النسخ", description: "تم نسخ جرد المخزن إلى الحافظة." }))
        .catch(() => toast({ title: "خطأ", description: "فشل نسخ جرد المخزن.", variant: 'destructive' }));
    }
  };


  return (
    <div className="container mx-auto p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">إدارة المخزون</h1>
        <p className="text-muted-foreground">إضافة، عرض، وتعديل منتجات المخزون.</p>
      </header>

      {/* Add Product Dialog Trigger and Search */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
         <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="btn-animated bg-accent hover:bg-accent/90 text-accent-foreground w-full md:w-auto">
                <PlusCircle className="ml-2 h-4 w-4" /> إضافة منتج جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>إضافة منتج جديد</DialogTitle>
                <DialogDescription>
                  أدخل تفاصيل المنتج الجديد. يمكنك استخدام ماسح الباركود.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddProduct} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="barcode" className="text-right">
                    باركود
                  </Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Input
                      id="barcode"
                      ref={barcodeInputRef}
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="flex-grow"
                      required
                    />
                    <Button type="button" size="icon" variant="outline" onClick={handleScanBarcode} className="btn-animated">
                      <Barcode className="h-4 w-4" />
                      <span className="sr-only">مسح باركود</span>
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="productName" className="text-right">
                    اسم المنتج
                  </Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="quantity" className="text-right">
                    الكمية
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="col-span-3"
                    min="0"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="price" className="text-right">
                    السعر
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="col-span-3"
                    min="0"
                    required
                  />
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                       <Button type="button" variant="outline">إلغاء</Button>
                    </DialogClose>
                   <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground btn-animated">إضافة المنتج</Button>
                 </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

           {/* Search Input */}
         <div className="relative w-full md:w-1/3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ابحث بالاسم أو الباركود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10" // Add padding for the icon
            />
         </div>
      </div>


      {/* Inventory Table Card */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
          <CardTitle>قائمة المنتجات</CardTitle>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={handleShareInventory} className="btn-animated">
               <Share2 className="ml-2 h-4 w-4" /> مشاركة
             </Button>
             <Button variant="outline" size="sm" onClick={handlePrintInventory} className="btn-animated">
               <Printer className="ml-2 h-4 w-4" /> طباعة
             </Button>
           </div>
        </CardHeader>
        <CardContent className="pt-4"> {/* Added padding top */}
          <ScrollArea className="h-[400px] w-full rounded-md border"> {/* Added ScrollArea */}
            <Table>
              <TableCaption>{filteredProducts.length === 0 ? 'لا توجد منتجات في المخزن.' : 'قائمة بجميع المنتجات الموجودة في المخزن.'}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">باركود</TableHead>
                  <TableHead>اسم المنتج</TableHead>
                  <TableHead className="text-center">الكمية</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium font-mono">{product.barcode}</TableCell> {/* Use mono for barcode */}
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="text-center">{product.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{product.price.toFixed(2)}</TableCell> {/* Use mono for price */}
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1 sm:gap-2"> {/* Reduced gap on small screens */}
                           <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)} className="text-blue-600 hover:text-blue-800 btn-animated h-8 w-8 sm:h-9 sm:w-9"> {/* Smaller icons */}
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">تعديل</span>
                           </Button>
                           <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 btn-animated h-8 w-8 sm:h-9 sm:w-9"> {/* Smaller icons */}
                              <Trash2 className="h-4 w-4" />
                               <span className="sr-only">حذف</span>
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                     <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                       {searchTerm ? 'لا توجد منتجات تطابق بحثك.' : 'لا توجد منتجات لعرضها. ابدأ بإضافة منتج جديد.'}
                     </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

       {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { resetForm(); setCurrentProduct(null); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>تعديل المنتج</DialogTitle>
             <DialogDescription>
               قم بتحديث تفاصيل المنتج المحدد.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditProduct} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-barcode" className="text-right">
                  باركود
                </Label>
                 <div className="col-span-3 flex items-center gap-2">
                   <Input
                     id="edit-barcode"
                     value={barcode}
                     onChange={(e) => setBarcode(e.target.value)}
                     className="flex-grow"
                     required
                   />
                   <Button type="button" size="icon" variant="outline" onClick={handleScanBarcode} className="btn-animated">
                      <Barcode className="h-4 w-4" />
                      <span className="sr-only">مسح باركود</span>
                   </Button>
                 </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-productName" className="text-right">
                  اسم المنتج
                </Label>
                <Input
                  id="edit-productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-quantity" className="text-right">
                  الكمية
                </Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="col-span-3"
                  min="0"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-price" className="text-right">
                  السعر
                </Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={price}
                   onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="col-span-3"
                  min="0"
                  required
                />
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline">إلغاء</Button>
                 </DialogClose>
                <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground btn-animated">حفظ التعديلات</Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
