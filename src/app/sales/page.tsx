
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { PlusCircle, Trash2, Printer, Share2, ShoppingCart, History, Eye } from 'lucide-react'; // Added History, Eye
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns'; // Import date-fns
import { arEG } from 'date-fns/locale'; // Import Arabic locale

// Re-use or import interfaces
interface Product {
  id: string;
  barcode: string;
  name: string;
  quantity: number; // Available quantity in inventory
  price: number; // Purchase price or base price from inventory
}

interface InvoiceItem extends Product {
  saleQuantity: number;
  salePrice: number; // Price used in this specific sale
}

interface Invoice {
    id: string;
    date: string; // Store date as ISO string for consistency
    items: InvoiceItem[];
    total: number;
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

// Helper function to save data to localStorage safely
const saveToLocalStorage = <T,>(key: string, data: T) => {
     if (typeof window === 'undefined') return; // Guard against server-side execution
     try {
         localStorage.setItem(key, JSON.stringify(data));
     } catch (error) {
          console.error(`Error saving ${key} to localStorage:`, error);
          // Optionally notify the user or implement fallback
     }
};

export default function SalesPage() {
  const { toast } = useToast();
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]); // Products available in inventory
  const [currentInvoiceItems, setCurrentInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [saleQuantity, setSaleQuantity] = useState<number | ''>(1);
  const [salePrice, setSalePrice] = useState<number | ''>(''); // State for custom sale price
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [isPastInvoicesOpen, setIsPastInvoicesOpen] = useState(false); // State for past invoices dialog
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null); // For previewing the just-created invoice
  const [pastInvoices, setPastInvoices] = useState<Invoice[]>([]); // State for historical invoices
  const [isLoadingInventory, setIsLoadingInventory] = useState(true); // Loading state

  // Load products and past invoices from local storage on mount
  useEffect(() => {
     setIsLoadingInventory(true);
     setInventoryProducts(loadFromLocalStorage<Product[]>('inventoryProducts', []));
     setPastInvoices(loadFromLocalStorage<Invoice[]>('salesInvoices', []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())); // Load and sort past invoices
     setIsLoadingInventory(false);
  }, []);

   // Update salePrice state when selected product changes
   useEffect(() => {
    if (selectedProductId) {
      const product = inventoryProducts.find(p => p.id === selectedProductId);
      if (product) {
        setSalePrice(product.price); // Set default sale price from inventory
      } else {
          setSalePrice(''); // Reset if product not found
      }
    } else {
      setSalePrice(''); // Reset if no product selected
    }
  }, [selectedProductId, inventoryProducts]);

  // --- Handlers ---

  const handleAddProductToInvoice = () => {
    if (!selectedProductId || saleQuantity === '' || Number(saleQuantity) <= 0 || salePrice === '' || Number(salePrice) < 0) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار منتج وإدخال كمية وسعر بيع صالحين.",
        variant: "destructive",
      });
      return;
    }

    const productToAdd = inventoryProducts.find((p) => p.id === selectedProductId);

    if (!productToAdd) {
      toast({ title: "خطأ", description: "لم يتم العثور على المنتج.", variant: "destructive" });
      return;
    }

     const currentSaleQuantity = Number(saleQuantity); // Ensure it's a number
     const currentSalePrice = Number(salePrice); // Ensure it's a number

    if (productToAdd.quantity < currentSaleQuantity) {
       toast({
        title: "خطأ",
        description: `الكمية المطلوبة (${currentSaleQuantity}) غير متوفرة. المتوفر: ${productToAdd.quantity}`,
        variant: "destructive",
      });
      return;
    }

    // Check if product already exists in the invoice *with the same sale price*
     // If you want to allow the same product with different prices, remove the salePrice check here
    const existingItemIndex = currentInvoiceItems.findIndex(item => item.id === productToAdd.id && item.salePrice === currentSalePrice);

    if (existingItemIndex > -1) {
        // Update quantity if product exists with the same price
        const updatedItems = [...currentInvoiceItems];
        const newTotalQuantity = updatedItems[existingItemIndex].saleQuantity + currentSaleQuantity;

         if (productToAdd.quantity < newTotalQuantity) {
            toast({
                title: "خطأ",
                description: `إجمالي الكمية المطلوبة (${newTotalQuantity}) يتجاوز المتوفر (${productToAdd.quantity}).`,
                variant: "destructive",
            });
            return;
        }

        updatedItems[existingItemIndex].saleQuantity = newTotalQuantity;
        setCurrentInvoiceItems(updatedItems);

    } else {
        // Add new item if product doesn't exist or has a different price
         const invoiceItem: InvoiceItem = {
            ...productToAdd, // Includes inventory price (base price)
            saleQuantity: currentSaleQuantity,
            salePrice: currentSalePrice, // The price for this specific sale
        };
        setCurrentInvoiceItems([...currentInvoiceItems, invoiceItem]);
    }


    // Reset fields after adding
    setSelectedProductId(undefined);
    setSaleQuantity(1);
    setSalePrice(''); // Reset sale price field
    toast({ title: "نجاح", description: `تمت إضافة ${productToAdd.name} إلى الفاتورة.` });
  };

  const handleRemoveProductFromInvoice = (id: string, price: number) => { // Need price to identify unique item if duplicates exist
    // Remove the first matching item (or handle quantity decrease if needed)
    const itemIndexToRemove = currentInvoiceItems.findIndex(item => item.id === id && item.salePrice === price);
     if (itemIndexToRemove > -1) {
        const updatedItems = [...currentInvoiceItems];
        updatedItems.splice(itemIndexToRemove, 1);
        setCurrentInvoiceItems(updatedItems);
        toast({ title: "نجاح", description: "تمت إزالة المنتج من الفاتورة." });
     }
  };

  const calculateTotal = () => {
    // Calculate total based on the actual salePrice used in the invoice item
    return currentInvoiceItems.reduce((sum, item) => sum + item.salePrice * item.saleQuantity, 0);
  };

  const handleFinalizeInvoice = () => {
    if (currentInvoiceItems.length === 0) {
      toast({ title: "خطأ", description: "الفاتورة فارغة. يرجى إضافة منتجات.", variant: "destructive" });
      return;
    }

    // 1. Create the invoice object
    const newInvoice: Invoice = {
        id: `INV-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, // More unique ID
        date: new Date().toISOString(), // Store as ISO string
        items: [...currentInvoiceItems], // Create a copy of items for the invoice
        total: calculateTotal(),
    };
    setCurrentInvoice(newInvoice); // Set the invoice for preview

    // 2. Update inventory quantities
    const updatedInventory = inventoryProducts.map(invProd => {
        // Sum up all quantities sold for this product ID across *all* items in the current invoice
        const totalSoldQuantity = currentInvoiceItems
            .filter(item => item.id === invProd.id)
            .reduce((sum, item) => sum + item.saleQuantity, 0);

        if (totalSoldQuantity > 0) {
            // Ensure quantity doesn't go below zero
            const newQuantity = Math.max(0, invProd.quantity - totalSoldQuantity);
            return { ...invProd, quantity: newQuantity };
        }
        return invProd;
    }).filter(p => p !== null) as Product[]; // Filter out any potential nulls if logic changes

    setInventoryProducts(updatedInventory);

    // 3. Persist the updated inventory to localStorage *immediately*
    saveToLocalStorage<Product[]>('inventoryProducts', updatedInventory);
    console.log("Inventory updated and saved:", updatedInventory); // Debug log


    // 4. Save the finalized invoice to the list in localStorage and update state
    const updatedPastInvoices = [newInvoice, ...pastInvoices]; // Add to the beginning
    setPastInvoices(updatedPastInvoices);
    saveToLocalStorage<Invoice[]>('salesInvoices', updatedPastInvoices); // Save sorted list
    console.log("Invoice saved:", newInvoice); // Debug log

    // 5. Open Preview Dialog
     setIsInvoicePreviewOpen(true);

    // 6. Clear current invoice form for the next one
    setCurrentInvoiceItems([]);
    setSelectedProductId(undefined); // Also reset selected product
    setSaleQuantity(1); // Reset quantity
    setSalePrice(''); // Reset sale price

    toast({ title: "نجاح", description: "تم إنشاء الفاتورة وتحديث المخزون بنجاح." });


  };

  // --- Print and Share Logic (Refactored for Reusability) ---
   const generateInvoiceHTML = (invoice: Invoice): string => {
       const invoiceDate = new Date(invoice.date); // Parse ISO string back to Date object
       const businessName = loadFromLocalStorage<string>('businessName', ''); // Load business name
       const businessPhone = loadFromLocalStorage<string>('businessPhone', ''); // Load business phone
       return `
        <html>
        <head>
            <title>فاتورة مبيعات - ${invoice.id}</title>
            <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
            .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); font-size: 14px; line-height: 20px; color: #555; } /* Adjusted font size and line height */
            .invoice-box table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
            .invoice-box table td { padding: 5px; vertical-align: top; text-align: right; }
            .invoice-box table tr td:nth-child(n+2) { text-align: center; } /* Center quantity and prices */
            .invoice-box table tr td:last-child { text-align: left; font-family: monospace; } /* Align total price left, monospace */
            .invoice-box table tr.heading td { text-align: right; background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; } /* Keep headers right aligned */
            .invoice-box table tr.heading td:nth-child(n+2) { text-align: center; } /* Center headers */
            .invoice-box table tr.heading td:last-child { text-align: left; } /* Align last header left */
            .invoice-box table tr.top table td { padding-bottom: 15px; } /* Reduced padding */
            .invoice-box table tr.top table td.title h2 { font-size: 24px; line-height: 24px; color: #333; margin: 0; } /* Adjusted title size */
            .invoice-box table tr.top table td.title p { font-size: 12px; color: #666; margin-top: 5px; }
            .invoice-box table tr.information table td { padding-bottom: 20px; } /* Reduced padding */
            .invoice-box table tr.item td { border-bottom: 1px solid #eee; }
            .invoice-box table tr.item.last td { border-bottom: none; }
            .invoice-box table tr.total td { border-top: 2px solid #eee; font-weight: bold; text-align: left; padding-top: 10px;}
            h1, h2, h3 { text-align: right; margin: 5px 0; }
            .rtl { direction: rtl; text-align: right; }
            .ltr { direction: ltr; text-align: left; font-size: 12px; color: #666;}
                @page { size: A4; margin: 1cm; }
                 @media print {
                     body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="invoice-box">
            <table>
                <tr class="top">
                <td colspan="4">
                    <table>
                    <tr>
                        <td class="title rtl">
                           ${businessName ? `<h2>${businessName}</h2>` : '<h2>فاتورة مبيعات</h2>'}
                           ${businessPhone ? `<p>${businessPhone}</p>` : ''}
                        </td>
                        <td class="ltr">
                           رقم الفاتورة: ${invoice.id}<br>
                           التاريخ: ${format(invoiceDate, 'yyyy/MM/dd HH:mm', { locale: arEG })}
                        </td>
                    </tr>
                    </table>
                </td>
                </tr>
                <tr class="heading">
                <td>المنتج</td>
                <td>الكمية</td>
                <td>سعر البيع</td>
                <td>الإجمالي</td>
                </tr>
                ${invoice.items.map(item => `
                <tr class="item">
                    <td>${item.name}</td>
                    <td>${item.saleQuantity}</td>
                    <td>${item.salePrice.toFixed(2)}</td>
                    <td>${(item.salePrice * item.saleQuantity).toFixed(2)}</td>
                </tr>
                `).join('')}
                <tr class="item last">
                    <td colspan="4" style="border-bottom: 1px solid #eee;"></td>
                </tr>
                <tr class="total">
                <td colspan="3"></td>
                <td><strong>الإجمالي الكلي: ${invoice.total.toFixed(2)}</strong></td>
                </tr>
            </table>
            </div>
        </body>
        </html>
       `;
   };

  const generateInvoiceText = (invoice: Invoice): string => {
       const invoiceDate = new Date(invoice.date);
       const businessName = loadFromLocalStorage<string>('businessName', ''); // Load business name
       const businessPhone = loadFromLocalStorage<string>('businessPhone', ''); // Load business phone
       return `${businessName ? businessName : 'فاتورة مبيعات'} (${invoice.id})\n` +
              `${businessPhone ? `الهاتف: ${businessPhone}\n` : ''}` +
              `التاريخ: ${format(invoiceDate, 'yyyy/MM/dd HH:mm', { locale: arEG })}\n` +
              `--------------------\n` +
              invoice.items.map(item => `- ${item.name}\n  (الكمية: ${item.saleQuantity}, سعر البيع: ${item.salePrice.toFixed(2)}, الإجمالي: ${(item.salePrice * item.saleQuantity).toFixed(2)})`).join('\n') +
              `\n--------------------\n` +
              `الإجمالي الكلي: ${invoice.total.toFixed(2)}`;
   };

  const handlePrintInvoice = (invoice: Invoice | null) => {
    if (!invoice) return;
    const printContent = generateInvoiceHTML(invoice);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => {
             try {
                printWindow.print();
            } catch (error) {
                console.error("Print error:", error);
                 toast({ title: "خطأ", description: "فشل بدء عملية الطباعة.", variant: "destructive" });
                 printWindow.close();
            }
        }, 500);
        toast({ title: "تم", description: "يتم تحضير الفاتورة للطباعة." });
    } else {
         toast({ title: "خطأ", description: "فشل فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.", variant: "destructive" });
    }
  };

 const handleShareInvoice = (invoice: Invoice | null) => {
    if (!invoice) return;
    const shareText = generateInvoiceText(invoice);

    if (navigator.share) {
      navigator.share({
        title: `فاتورة مبيعات - ${invoice.id}`,
        text: shareText,
      })
      .then(() => toast({ title: "نجاح", description: "تمت مشاركة الفاتورة." }))
      .catch((error) => {
         console.error("Share error:", error);
          if (error.name !== 'AbortError') {
             toast({ title: "خطأ", description: `لم تتم المشاركة: ${error.message || error}`, variant: 'destructive' });
          } else {
             toast({ title: "إلغاء", description: "تم إلغاء المشاركة.", variant: "default" });
          }
      });
    } else {
      navigator.clipboard.writeText(shareText)
        .then(() => toast({ title: "تم النسخ", description: "تم نسخ تفاصيل الفاتورة إلى الحافظة." }))
        .catch(() => toast({ title: "خطأ", description: "فشل نسخ تفاصيل الفاتورة.", variant: 'destructive' }));
    }
  };

   // Function to open preview for a past invoice
   const handleViewInvoice = (invoice: Invoice) => {
       setCurrentInvoice(invoice);
       setIsInvoicePreviewOpen(true);
       setIsPastInvoicesOpen(false); // Close past invoices list if open
   };


  if (isLoadingInventory) {
     return <div className="container mx-auto p-4 text-center">جارٍ تحميل بيانات المخزون...</div>;
  }


  return (
    <div className="container mx-auto p-4">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
         <div>
            <h1 className="text-3xl font-bold text-primary">إدارة المبيعات</h1>
            <p className="text-muted-foreground">إنشاء فواتير جديدة وإدارة عمليات البيع.</p>
         </div>
         {/* Button to view past invoices */}
          <Dialog open={isPastInvoicesOpen} onOpenChange={setIsPastInvoicesOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="btn-animated">
                    <History className="ml-2 h-4 w-4" /> عرض الفواتير السابقة
                </Button>
            </DialogTrigger>
             <DialogContent className="sm:max-w-3xl"> {/* Wider for past invoices */}
                <DialogHeader>
                    <DialogTitle>الفواتير السابقة</DialogTitle>
                    <DialogDescription>قائمة بجميع فواتير المبيعات الصادرة (الأحدث أولاً).</DialogDescription>
                </DialogHeader>
                 <ScrollArea className="h-[500px] w-full rounded-md border mt-4">
                    <Table>
                        <TableCaption>{pastInvoices.length === 0 ? 'لا توجد فواتير سابقة.' : 'انقر على فاتورة لعرضها أو طباعتها.'}</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم الفاتورة</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead className="text-right">الإجمالي</TableHead>
                                <TableHead className="text-center">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pastInvoices.length > 0 ? (
                                pastInvoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.id}</TableCell>
                                        <TableCell>{format(new Date(invoice.date), 'yyyy/MM/dd HH:mm')}</TableCell>
                                        <TableCell className="text-right font-mono">{invoice.total.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                             <Button variant="ghost" size="icon" onClick={() => handleViewInvoice(invoice)} className="text-blue-600 hover:text-blue-800 btn-animated h-8 w-8">
                                                 <Eye className="h-4 w-4" />
                                                 <span className="sr-only">عرض الفاتورة</span>
                                             </Button>
                                             {/* Add print/share icons directly here if needed */}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                        لم يتم إصدار أي فواتير بعد.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </ScrollArea>
                <DialogFooter>
                     <DialogClose asChild>
                         <Button type="button" variant="secondary">إغلاق</Button>
                     </DialogClose>
                 </DialogFooter>
             </DialogContent>
          </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Product Section */}
        <Card className="md:col-span-1 shadow-lg">
          <CardHeader>
            <CardTitle>إضافة منتج للفاتورة</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
             <div className="grid gap-2">
                <Label htmlFor="productSelect">اختر منتج</Label>
                 <Select value={selectedProductId ?? ''} onValueChange={(value) => setSelectedProductId(value === 'no-products' ? undefined : value)}>
                  <SelectTrigger id="productSelect">
                    <SelectValue placeholder="-- اختر منتج --" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryProducts.filter(p => p.quantity > 0).length > 0 ? (
                       inventoryProducts.filter(p => p.quantity > 0).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (المتوفر: {product.quantity})
                        </SelectItem>
                      ))
                    ) : (
                         <SelectItem value="no-products" disabled>لا توجد منتجات متاحة في المخزون</SelectItem>
                    )}

                  </SelectContent>
                </Select>
             </div>
              {/* Sale Price Input */}
               <div className="grid gap-2">
                 <Label htmlFor="salePrice">سعر البيع</Label>
                 <Input
                   id="salePrice"
                   type="number"
                   step="0.01"
                   min="0"
                   value={salePrice}
                   onChange={(e) => setSalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="أدخل سعر البيع"
                   disabled={!selectedProductId} // Disable if no product is selected
                   required
                 />
                 {selectedProductId && (
                    <p className="text-xs text-muted-foreground mt-1">
                        السعر المسجل بالمخزون: {inventoryProducts.find(p=>p.id === selectedProductId)?.price.toFixed(2) ?? 'N/A'}
                    </p>
                 )}
               </div>
             <div className="grid gap-2">
                <Label htmlFor="saleQuantity">الكمية</Label>
                <Input
                  id="saleQuantity"
                  type="number"
                  min="1"
                  value={saleQuantity}
                  onChange={(e) => setSaleQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="أدخل الكمية"
                   disabled={!selectedProductId} // Disable if no product is selected
                   required
                />
             </div>
          </CardContent>
           <CardFooter>
             <Button
                onClick={handleAddProductToInvoice}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground btn-animated"
                disabled={!selectedProductId || saleQuantity === '' || Number(saleQuantity) <= 0 || salePrice === '' || Number(salePrice) < 0} // Updated disable condition
              >
               <PlusCircle className="ml-2 h-4 w-4" /> إضافة للفاتورة
             </Button>
           </CardFooter>
        </Card>

        {/* Current Invoice Section */}
        <Card className="md:col-span-2 shadow-lg">
          <CardHeader className="border-b pb-4">
            <CardTitle>الفاتورة الحالية</CardTitle>
             <CardDescription>
                إجمالي الفاتورة: <span className="font-bold">{calculateTotal().toFixed(2)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4"> {/* Add padding top */}
            <ScrollArea className="h-[300px] w-full rounded-md border"> {/* Added ScrollArea */}
                <Table>
                 <TableCaption>{currentInvoiceItems.length === 0 ? 'لم تتم إضافة أي منتجات بعد.' : 'المنتجات المضافة إلى الفاتورة الحالية.'}</TableCaption>
                <TableHeader>
                    <TableRow>
                    <TableHead>اسم المنتج</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-right">سعر البيع</TableHead> {/* Changed header */}
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-center">إزالة</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentInvoiceItems.length > 0 ? (
                    currentInvoiceItems.map((item) => (
                        <TableRow key={`${item.id}-${item.salePrice}`}> {/* Make key more unique */}
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center font-mono">{item.saleQuantity}</TableCell>
                        <TableCell className="text-right font-mono">{item.salePrice.toFixed(2)}</TableCell> {/* Show sale price */}
                        <TableCell className="text-right font-mono">{(item.salePrice * item.saleQuantity).toFixed(2)}</TableCell> {/* Calculate with sale price */}
                        <TableCell className="text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveProductFromInvoice(item.id, item.salePrice)} className="text-red-600 hover:text-red-800 btn-animated h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                             <span className="sr-only">إزالة</span>
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                         الفاتورة فارغة. قم بإضافة منتجات من القائمة أعلاه.
                        </TableCell>
                     </TableRow>
                    )}
                </TableBody>
                </Table>
            </ScrollArea>
          </CardContent>
           <CardFooter className="flex justify-end border-t pt-4">
            <Button onClick={handleFinalizeInvoice} disabled={currentInvoiceItems.length === 0} className="bg-primary hover:bg-primary/90 btn-animated">
                <ShoppingCart className="ml-2 h-4 w-4" /> إنشاء الفاتورة
            </Button>
           </CardFooter>
        </Card>
      </div>

       {/* Invoice Preview Dialog */}
      <Dialog open={isInvoicePreviewOpen} onOpenChange={setIsInvoicePreviewOpen}>
         <DialogContent className="sm:max-w-2xl"> {/* Wider dialog for invoice */}
           <DialogHeader>
             <DialogTitle>فاتورة - {currentInvoice?.id}</DialogTitle>
              <DialogDescription>
                {currentInvoice?.id?.startsWith('INV-') ? 'تم إنشاء الفاتورة بنجاح.' : 'معاينة الفاتورة.'} يمكنك طباعتها أو مشاركتها.
            </DialogDescription>
           </DialogHeader>
            {currentInvoice && (
                 <div className="py-4">
                   <div className="mb-4 text-sm text-muted-foreground">
                     <strong>التاريخ:</strong> {format(new Date(currentInvoice.date), 'yyyy/MM/dd HH:mm', { locale: arEG })}
                   </div>
                   <ScrollArea className="h-[350px] border rounded-md mb-4">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>المنتج</TableHead>
                            <TableHead className="text-center">الكمية</TableHead>
                            <TableHead className="text-right">سعر البيع</TableHead>
                            <TableHead className="text-right">الإجمالي</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {currentInvoice.items.map(item => (
                            <TableRow key={`${item.id}-${item.salePrice}`}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-center font-mono">{item.saleQuantity}</TableCell>
                            <TableCell className="text-right font-mono">{item.salePrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{(item.salePrice * item.saleQuantity).toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                         <TableBody>
                             <TableRow className="border-t-2 border-primary">
                                 <TableCell colSpan={3} className="text-left font-bold">الإجمالي الكلي:</TableCell>
                                 <TableCell className="text-right font-bold font-mono">{currentInvoice.total.toFixed(2)}</TableCell>
                             </TableRow>
                         </TableBody>
                    </Table>
                   </ScrollArea>
                 </div>
            )}
           <DialogFooter className="justify-between sm:justify-between"> {/* Adjust footer layout */}
              <div className="flex gap-2">
                 <Button variant="outline" onClick={() => handleShareInvoice(currentInvoice)} className="btn-animated">
                   <Share2 className="ml-2 h-4 w-4" /> مشاركة
                 </Button>
                 <Button variant="outline" onClick={() => handlePrintInvoice(currentInvoice)} className="btn-animated">
                   <Printer className="ml-2 h-4 w-4" /> طباعة
                 </Button>
              </div>
              <DialogClose asChild>
                 <Button type="button" variant="secondary">إغلاق</Button>
               </DialogClose>
           </DialogFooter>
         </DialogContent>
       </Dialog>


    </div>
  );
}
