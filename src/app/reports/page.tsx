
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Package, Users, TrendingUp, TrendingDown, AlertCircle, BarChart2, LineChart, PieChart as PieIcon } from 'lucide-react'; // Added specific chart icons
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart as RechartsLineChart, Pie, PieChart as RechartsPieChart, Cell } from "recharts"; // Renamed LineChart and PieChart to avoid conflict
import { arEG } from 'date-fns/locale'; // Import Arabic locale for date formatting
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// --- Data Structures ---
// Reuse or import existing interfaces
interface Product {
  id: string;
  barcode: string;
  name: string;
  quantity: number;
  price: number;
}

interface InvoiceItem extends Product {
  saleQuantity: number;
  salePrice: number; // Added salePrice to invoice item
}

interface Invoice {
  id: string;
  date: string; // ISO string date
  items: InvoiceItem[];
  total: number;
}

interface Debtor {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  balance: number;
  phone?: string;
}

interface DebtTransaction {
  id: string;
  debtorId: string;
  date: string; // ISO string date
  description: string;
  amount: number;
  type: 'debt' | 'payment';
}

// --- Chart Colors ---
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#A4DE6C", "#D0ED57", "#FFC658", "#FF7F50"]; // Added more colors
const chartConfig = {
    totalSales: { label: "إجمالي المبيعات", color: "hsl(var(--chart-1))", icon: DollarSign },
    totalCost: { label: "إجمالي التكلفة (تقديري)", color: "hsl(var(--chart-2))", icon: DollarSign },
    profit: { label: "الربح (تقديري)", color: "hsl(var(--chart-3))", icon: TrendingUp },
    inventoryValue: { label: "قيمة المخزون", color: "hsl(var(--chart-4))", icon: Package },
    receivables: { label: "ديون العملاء", color: "hsl(var(--chart-5))", icon: Users },
    payables: { label: "ديون الموردين", color: "hsl(var(--destructive))", icon: Users },
} satisfies ChartConfig;

// --- Helper Functions ---
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue === null || storedValue === 'undefined') {
             // If null or 'undefined' string, return default
            return defaultValue;
        }
        return JSON.parse(storedValue);
    } catch (error) {
        console.error(`Error loading or parsing ${key} from localStorage:`, error);
         // Attempt to clear potentially corrupted data
         try {
             localStorage.removeItem(key);
         } catch (removeError) {
             console.error(`Error removing corrupted key ${key} from localStorage:`, removeError);
         }
        return defaultValue;
    }
};


// --- Balance Calculation ---
const calculateBalance = (debtorId: string, allTransactions: DebtTransaction[], debtorType: 'customer' | 'supplier'): number => {
  const relevantTransactions = allTransactions.filter(t => t.debtorId === debtorId);

  return relevantTransactions.reduce((acc, transaction) => {
    // Ensure amount is a number, default to 0 if not
     const amount = typeof transaction.amount === 'number' ? transaction.amount : 0;

    if (debtorType === 'customer') {
      // Customer: Debt increases balance (they owe us more), Payment decreases balance (they paid)
      return transaction.type === 'debt' ? acc + amount : acc - amount;
    } else {
      // Supplier: Debt decreases balance (we owe them more), Payment increases balance (we paid them)
      return transaction.type === 'debt' ? acc - amount : acc + amount;
    }
  }, 0);
};


// --- Main Component ---
export default function ReportsPage() {
    const [inventory, setInventory] = useState<Product[]>([]);
    const [sales, setSales] = useState<Invoice[]>([]);
    const [debtors, setDebtors] = useState<Debtor[]>([]);
    const [debtTransactions, setDebtTransactions] = useState<DebtTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null); // State for error messages
    const [dateRange, setDateRange] = useState('thisMonth'); // 'thisMonth', 'lastMonth', 'allTime'

    // --- Data Loading ---
    useEffect(() => {
        setIsLoading(true);
        setError(null); // Reset error on new load attempt
        try {
            const loadedInventory = loadFromLocalStorage<Product[]>('inventoryProducts', []);
            const loadedSales = loadFromLocalStorage<Invoice[]>('salesInvoices', []);
            const loadedDebtorsRaw = loadFromLocalStorage<Debtor[]>('debtors', []);
            const loadedTransactions = loadFromLocalStorage<DebtTransaction[]>('debtTransactions', []);

            // Validate loaded data (basic checks)
            if (!Array.isArray(loadedInventory) || !Array.isArray(loadedSales) || !Array.isArray(loadedDebtorsRaw) || !Array.isArray(loadedTransactions)) {
                 throw new Error("Data loaded from storage is not in the expected array format.");
            }


            // Calculate debtor balances (important for debt reports)
            const updatedDebtorsWithBalance = loadedDebtorsRaw.map(debtor => {
                 // Add basic validation for debtor object
                if (!debtor || typeof debtor.id !== 'string' || (debtor.type !== 'customer' && debtor.type !== 'supplier')) {
                     console.warn("Skipping invalid debtor object during balance calculation:", debtor);
                     return null; // Or handle as needed, maybe filter out later
                }
                const balance = calculateBalance(debtor.id, loadedTransactions, debtor.type);
                return { ...debtor, balance };
            }).filter(d => d !== null) as Debtor[]; // Filter out any nulls from invalid debtors

            setInventory(loadedInventory);
            setSales(loadedSales);
            setDebtors(updatedDebtorsWithBalance); // Use updated debtors with balance
            setDebtTransactions(loadedTransactions);
        } catch (err: any) {
             console.error("Failed to load or process report data:", err);
             setError(`فشل تحميل بيانات التقارير: ${err.message || 'خطأ غير معروف'}`);
              // Reset states to default empty arrays on error
             setInventory([]);
             setSales([]);
             setDebtors([]);
             setDebtTransactions([]);
        } finally {
            setIsLoading(false);
        }
    }, []); // Run once on mount

    // --- Date Filtering Logic ---
    const filteredSales = useMemo(() => {
         if (!Array.isArray(sales)) return []; // Ensure sales is an array
        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = endOfDay(now); // Default to end of today

        if (dateRange === 'thisMonth') {
            startDate = startOfMonth(now);
        } else if (dateRange === 'lastMonth') {
            const lastMonthStart = startOfMonth(subMonths(now, 1));
            startDate = lastMonthStart;
            endDate = endOfMonth(lastMonthStart);
        } else if (dateRange === 'allTime') {
            startDate = null; // No start date filter
            endDate = null; // No end date filter
        }

        return sales.filter(sale => {
             // Basic validation for sale object and date
             if (!sale || !sale.date) return false;
            try {
                 const saleDate = new Date(sale.date);
                 // Check if date is valid
                 if (isNaN(saleDate.getTime())) return false;

                const afterStartDate = startDate ? saleDate >= startDate : true;
                const beforeEndDate = endDate ? saleDate <= endDate : true;
                return afterStartDate && beforeEndDate;
            } catch (e) {
                 console.error("Error processing sale date:", sale.date, e);
                 return false; // Skip if date is invalid
            }
        });
    }, [sales, dateRange]);

    const filteredDebtTransactions = useMemo(() => {
         if (!Array.isArray(debtTransactions)) return []; // Ensure debtTransactions is an array
         const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = endOfDay(now); // Default to end of today

        if (dateRange === 'thisMonth') {
            startDate = startOfMonth(now);
        } else if (dateRange === 'lastMonth') {
            const lastMonthStart = startOfMonth(subMonths(now, 1));
            startDate = lastMonthStart;
            endDate = endOfMonth(lastMonthStart);
        } else if (dateRange === 'allTime') {
            startDate = null; // No start date filter
             endDate = null; // No end date filter
        }

         return debtTransactions.filter(trans => {
             // Basic validation for transaction object and date
             if (!trans || !trans.date) return false;
             try {
                 const transDate = new Date(trans.date);
                 // Check if date is valid
                 if (isNaN(transDate.getTime())) return false;

                 const afterStartDate = startDate ? transDate >= startDate : true;
                 const beforeEndDate = endDate ? transDate <= endDate : true;
                 return afterStartDate && beforeEndDate;
             } catch (e) {
                  console.error("Error processing transaction date:", trans.date, e);
                  return false; // Skip if date is invalid
             }
         });
     }, [debtTransactions, dateRange]);


    // --- Report Calculations ---
    // Add checks for valid numbers
    const totalSalesValue = useMemo(() => filteredSales.reduce((sum, sale) => sum + (typeof sale.total === 'number' ? sale.total : 0), 0), [filteredSales]);
    const totalSoldItems = useMemo(() => filteredSales.reduce((sum, sale) => {
        if (!Array.isArray(sale.items)) return sum;
        return sum + sale.items.reduce((itemSum, item) => itemSum + (typeof item.saleQuantity === 'number' ? item.saleQuantity : 0), 0);
    }, 0), [filteredSales]);
    const averageInvoiceValue = useMemo(() => filteredSales.length > 0 ? totalSalesValue / filteredSales.length : 0, [totalSalesValue, filteredSales.length]);

    const totalInventoryValue = useMemo(() => inventory.reduce((sum, product) => {
        const quantity = typeof product.quantity === 'number' ? product.quantity : 0;
        const price = typeof product.price === 'number' ? product.price : 0;
        return sum + quantity * price;
    }, 0), [inventory]);
    const totalInventoryItems = useMemo(() => inventory.reduce((sum, product) => sum + (typeof product.quantity === 'number' ? product.quantity : 0), 0), [inventory]);

    const totalReceivables = useMemo(() => debtors.filter(d => d.type === 'customer' && d.balance > 0).reduce((sum, d) => sum + (typeof d.balance === 'number' ? d.balance : 0), 0), [debtors]);
    const totalPayables = useMemo(() => debtors.filter(d => d.type === 'supplier' && d.balance < 0).reduce((sum, d) => sum + Math.abs(typeof d.balance === 'number' ? d.balance : 0), 0), [debtors]);
    const netDebtPosition = totalReceivables - totalPayables; // Positive means more owed to us, negative means we owe more

    // --- Data for Charts ---
     const salesByDayData = useMemo(() => {
        const salesMap = new Map<string, number>();
         if (!Array.isArray(filteredSales)) return [];
        filteredSales.forEach(sale => {
             if (!sale || !sale.date || typeof sale.total !== 'number') return; // Skip invalid sales
             try {
                const saleDate = new Date(sale.date);
                if (isNaN(saleDate.getTime())) return; // Skip invalid dates
                const day = format(saleDate, 'yyyy-MM-dd');
                salesMap.set(day, (salesMap.get(day) || 0) + sale.total);
             } catch (e) {
                 console.error("Error processing sale date for chart:", sale.date, e);
             }
        });
        // Sort by date
        return Array.from(salesMap.entries())
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([date, totalSales]) => ({ date, totalSales }));
    }, [filteredSales]);

     const topSellingProductsData = useMemo(() => {
        const productSales = new Map<string, { name: string; quantity: number; value: number }>();
         if (!Array.isArray(filteredSales)) return [];
        filteredSales.forEach(sale => {
             if (!sale || !Array.isArray(sale.items)) return; // Skip invalid sales or sales without items
            sale.items.forEach(item => {
                 // Use salePrice for value calculation
                 if (!item || typeof item.id !== 'string' || typeof item.saleQuantity !== 'number' || typeof item.salePrice !== 'number') return; // Skip invalid items
                const existing = productSales.get(item.id);
                const itemValue = item.saleQuantity * item.salePrice; // Use salePrice
                if (existing) {
                    existing.quantity += item.saleQuantity;
                    existing.value += itemValue;
                } else {
                    productSales.set(item.id, {
                        name: item.name || `منتج (${item.id})`, // Fallback name
                        quantity: item.saleQuantity,
                        value: itemValue,
                    });
                }
            });
        });
         // Sort by value (descending) and take top 5
        return Array.from(productSales.values())
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filteredSales]);

      const inventoryValueByCategoryData = useMemo(() => {
         if (!Array.isArray(inventory)) return []; // Ensure inventory is an array
        // Assuming no categories for now, return value per product (top 10 by value)
        return inventory
            .map(p => {
                const quantity = typeof p.quantity === 'number' ? p.quantity : 0;
                const price = typeof p.price === 'number' ? p.price : 0;
                 return { name: p.name || `منتج (${p.id})`, value: quantity * price }; // Fallback name
            })
            .filter(p => p.value > 0) // Only include items with value
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Limit to top 10 for Pie chart clarity
    }, [inventory]);

    const debtOverviewData = useMemo(() => [ // Added useMemo
        { name: 'مستحقات (عملاء)', value: totalReceivables, fill: 'hsl(var(--chart-5))' },
        { name: 'مدفوعات (موردين)', value: totalPayables, fill: 'hsl(var(--destructive))' },
    ], [totalReceivables, totalPayables]); // Dependencies


    // --- Loading State ---
    if (isLoading) {
        return <div className="container mx-auto p-4 text-center">جارٍ تحميل بيانات التقارير...</div>;
    }

    // --- Error State ---
     if (error) {
       return (
         <div className="container mx-auto p-4">
           <Alert variant="destructive">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>خطأ في تحميل التقارير</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
         </div>
       );
     }

    // --- Render Logic ---
    const renderDateRangeLabel = () => {
        switch (dateRange) {
            case 'thisMonth': return `(${format(new Date(), 'MMMM yyyy', { locale: arEG })})`;
            case 'lastMonth': return `(${format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: arEG })})`;
            case 'allTime': return '(كل الأوقات)';
            default: return '';
        }
    };

    const SafeBarChart = ({ data, ...props }: any) => {
        if (!Array.isArray(data) || data.length === 0) {
            return <p className="text-center text-muted-foreground py-10">لا توجد بيانات لعرض الرسم البياني.</p>;
        }
        return <BarChart data={data} {...props} />;
    };

    const SafeLineChart = ({ data, ...props }: any) => {
        if (!Array.isArray(data) || data.length === 0) {
            return <p className="text-center text-muted-foreground py-10">لا توجد بيانات لعرض الرسم البياني.</p>;
        }
        return <RechartsLineChart data={data} {...props} />;
    };

     const SafePieChart = ({ data, ...props }: any) => {
         if (!Array.isArray(data) || data.length === 0 || data.every(d => d.value === 0)) {
            return <p className="text-center text-muted-foreground py-10">لا توجد بيانات لعرض الرسم البياني.</p>;
        }
         return <RechartsPieChart {...props} />;
    };

    return (
        <div className="container mx-auto p-2 sm:p-4">
            <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4"> {/* Adjusted margin and gap */}
                <h1 className="text-2xl md:text-3xl font-bold text-primary">التقارير الشاملة</h1>
                 <div className="flex items-center gap-2 self-end sm:self-center"> {/* Adjusted alignment */}
                      <Label htmlFor="dateRange" className="text-xs sm:text-sm font-medium shrink-0">الفترة:</Label>
                      <Select value={dateRange} onValueChange={setDateRange}>
                         <SelectTrigger id="dateRange" className="w-[150px] sm:w-[180px] h-9 text-xs sm:text-sm"> {/* Adjusted width/height/text */}
                           <SelectValue placeholder="اختر الفترة الزمنية" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="thisMonth">هذا الشهر</SelectItem>
                           <SelectItem value="lastMonth">الشهر الماضي</SelectItem>
                           <SelectItem value="allTime">كل الأوقات</SelectItem>
                         </SelectContent>
                       </Select>
                 </div>

            </header>

            {/* Overview Section */}
             <Card className="mb-6 shadow-md border border-border/50">
                <CardHeader className="p-3 sm:p-4"> {/* Reduced padding */}
                    <CardTitle className="text-base sm:text-lg md:text-xl">نظرة عامة {renderDateRangeLabel()}</CardTitle> {/* Adjusted size */}
                    <CardDescription className="text-xs sm:text-sm">ملخص لأهم مؤشرات الأداء للفترة المحددة.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4"> {/* Reduced gap & padding */}
                     <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2 sm:p-3 rounded-lg"> {/* Added rounded-lg */}
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                           <CardTitle className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">إجمالي المبيعات</CardTitle>
                           <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                         </CardHeader>
                         <CardContent className="p-0 pt-1 sm:pt-2">
                           <div className="text-base sm:text-xl md:text-2xl font-bold text-blue-900 dark:text-blue-100">{totalSalesValue.toFixed(2)}</div> {/* Adjusted size */}
                           <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300">من {filteredSales.length} فاتورة</p>
                         </CardContent>
                     </Card>
                      <Card className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 p-2 sm:p-3 rounded-lg">
                         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                           <CardTitle className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-200">قيمة المخزون</CardTitle>
                           <Package className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                         </CardHeader>
                         <CardContent className="p-0 pt-1 sm:pt-2">
                           <div className="text-base sm:text-xl md:text-2xl font-bold text-green-900 dark:text-green-100">{totalInventoryValue.toFixed(2)}</div>
                           <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300">{inventory.length} صنف ({totalInventoryItems} قطعة)</p>
                         </CardContent>
                     </Card>
                     <Card className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 p-2 sm:p-3 rounded-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                           <CardTitle className="text-xs sm:text-sm font-medium text-yellow-800 dark:text-yellow-200">المستحقات (لك)</CardTitle>
                           <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
                         </CardHeader>
                         <CardContent className="p-0 pt-1 sm:pt-2">
                           <div className="text-base sm:text-xl md:text-2xl font-bold text-yellow-900 dark:text-yellow-100">{totalReceivables.toFixed(2)}</div>
                            <p className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300">من العملاء</p>
                         </CardContent>
                     </Card>
                     <Card className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 p-2 sm:p-3 rounded-lg">
                         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                           <CardTitle className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-200">المدفوعات (عليك)</CardTitle>
                           <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
                         </CardHeader>
                         <CardContent className="p-0 pt-1 sm:pt-2">
                           <div className="text-base sm:text-xl md:text-2xl font-bold text-red-900 dark:text-red-100">{totalPayables.toFixed(2)}</div>
                           <p className="text-[10px] sm:text-xs text-red-700 dark:text-red-300">للموردين</p>
                         </CardContent>
                     </Card>
                 </CardContent>
             </Card>


            {/* Detailed Reports Section */}
             <Tabs defaultValue="sales" className="w-full">
               <TabsList className="grid w-full grid-cols-3 mb-4 h-9 sm:h-10 text-xs sm:text-sm"> {/* Adjusted height and text size */}
                 <TabsTrigger value="sales" className="flex items-center gap-1 sm:gap-2"><DollarSign className="h-3 w-3 sm:h-4 sm:w-4"/>المبيعات</TabsTrigger>
                 <TabsTrigger value="inventory" className="flex items-center gap-1 sm:gap-2"><Package className="h-3 w-3 sm:h-4 sm:w-4"/>المخزون</TabsTrigger>
                 <TabsTrigger value="debts" className="flex items-center gap-1 sm:gap-2"><Users className="h-3 w-3 sm:h-4 sm:w-4"/>الديون</TabsTrigger>
               </TabsList>

                {/* Sales Reports */}
               <TabsContent value="sales">
                 <Card className="shadow-lg border border-border/50">
                   <CardHeader className="p-3 sm:p-6 border-b border-border/30"> {/* Adjusted padding, added border */}
                     <CardTitle className="text-base sm:text-xl flex items-center gap-2"><LineChart className="h-4 w-4 sm:h-5 sm:w-5 text-primary"/> تقرير المبيعات {renderDateRangeLabel()}</CardTitle>
                     <CardDescription className="text-xs sm:text-sm">تحليل أداء المبيعات والمنتجات الأكثر رواجاً.</CardDescription>
                   </CardHeader>
                   <CardContent className="grid gap-4 p-3 sm:p-6"> {/* Adjusted padding and gap */}
                      {/* Sales Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 text-center">
                           <div className="p-2 sm:p-4 bg-muted/60 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">إجمالي المبيعات</p>
                              <p className="text-base sm:text-xl font-bold font-mono">{totalSalesValue.toFixed(2)}</p>
                           </div>
                            <div className="p-2 sm:p-4 bg-muted/60 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">عدد الفواتير</p>
                              <p className="text-base sm:text-xl font-bold font-mono">{filteredSales.length}</p>
                           </div>
                            <div className="p-2 sm:p-4 bg-muted/60 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">متوسط قيمة الفاتورة</p>
                              <p className="text-base sm:text-xl font-bold font-mono">{averageInvoiceValue.toFixed(2)}</p>
                           </div>
                      </div>

                       {/* Sales Charts */}
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Sales Trend Chart */}
                           <Card className="border border-border/40">
                             <CardHeader className="p-3 sm:p-4">
                               <CardTitle className="text-sm sm:text-base">اتجاه المبيعات اليومي</CardTitle>
                             </CardHeader>
                             <CardContent className="p-1 sm:p-2">
                                 <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] w-full"> {/* Adjusted height */}
                                   <SafeLineChart data={salesByDayData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}> {/* Adjusted margin */}
                                     <CartesianGrid strokeDasharray="3 3" />
                                     <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM')} fontSize={10} /> {/* Smaller font */}
                                     <YAxis width={40} fontSize={10} tickFormatter={(value) => value.toLocaleString()} /> {/* Smaller font, adjusted width */}
                                     <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                     <Line type="monotone" dataKey="totalSales" stroke="var(--color-totalSales)" strokeWidth={2} dot={false} name="إجمالي المبيعات" />
                                   </SafeLineChart>
                                 </ChartContainer>
                             </CardContent>
                           </Card>

                           {/* Top Selling Products Chart */}
                            <Card className="border border-border/40">
                               <CardHeader className="p-3 sm:p-4">
                                <CardTitle className="text-sm sm:text-base">الأكثر مبيعاً (قيمة)</CardTitle>
                               </CardHeader>
                               <CardContent className="p-1 sm:p-2">
                                  <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] w-full"> {/* Adjusted height */}
                                    <SafeBarChart data={topSellingProductsData} layout="vertical" margin={{ right: 5, left: 10 }}> {/* Adjusted margin */}
                                      <CartesianGrid horizontal={false} />
                                      <XAxis type="number" hide />
                                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} stroke="#888" fontSize={10} width={90} interval={0} /> {/* Smaller font, adjusted width */}
                                       <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                                      <Bar dataKey="value" fill="var(--color-totalSales)" radius={3} name="قيمة المبيعات"> {/* Smaller radius */}
                                        {topSellingProductsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                      </Bar>
                                    </SafeBarChart>
                                  </ChartContainer>
                               </CardContent>
                             </Card>
                       </div>

                       {/* Detailed Sales Table */}
                        <Card className="border border-border/40">
                            <CardHeader className="p-3 sm:p-4">
                                <CardTitle className="text-sm sm:text-base">تفاصيل الفواتير</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 sm:p-2">
                                <ScrollArea className="h-[300px] sm:h-[400px] w-full rounded-md border"> {/* Adjusted height */}
                                <Table>
                                    <TableCaption className="text-xs sm:text-sm">{filteredSales.length === 0 ? 'لا توجد فواتير في هذه الفترة.' : 'قائمة الفواتير الصادرة.'}</TableCaption>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm p-2 sm:p-4">رقم الفاتورة</TableHead> {/* Adjusted padding & size */}
                                        <TableHead className="text-xs sm:text-sm p-2 sm:p-4">التاريخ</TableHead>
                                        <TableHead className="text-right text-xs sm:text-sm p-2 sm:p-4">الإجمالي</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {filteredSales.length > 0 ? (
                                        filteredSales.sort((a,b) => {
                                             // Sort by date, handling potentially invalid dates
                                            try {
                                                return new Date(b.date).getTime() - new Date(a.date).getTime();
                                            } catch {
                                                return 0; // Maintain order if dates are invalid
                                            }
                                        }).map((sale) => (
                                            sale && sale.id ? ( // Check if sale and sale.id exist
                                                <TableRow key={sale.id}>
                                                    <TableCell className="font-medium text-xs sm:text-sm p-2 sm:p-4">{sale.id}</TableCell> {/* Adjusted padding & size */}
                                                    <TableCell className="text-xs sm:text-sm p-2 sm:p-4">
                                                        {sale.date ? (
                                                            (() => {
                                                                try {
                                                                    return format(new Date(sale.date), 'yyyy/MM/dd HH:mm');
                                                                } catch {
                                                                    return 'تاريخ غير صالح';
                                                                }
                                                            })()
                                                        ) : 'لا يوجد تاريخ'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs sm:text-sm p-2 sm:p-4"> {/* Adjusted size */}
                                                        {typeof sale.total === 'number' ? sale.total.toFixed(2) : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : null // Skip rendering if sale or sale.id is invalid
                                        ))
                                    ) : (
                                        <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24 text-xs sm:text-sm"> {/* Adjusted size */}
                                            لا توجد فواتير لعرضها.
                                        </TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                   </CardContent>
                 </Card>
               </TabsContent>

               {/* Inventory Reports */}
               <TabsContent value="inventory">
                 <Card className="shadow-lg border border-border/50">
                   <CardHeader className="p-3 sm:p-6 border-b border-border/30">
                     <CardTitle className="text-base sm:text-xl flex items-center gap-2"><PieIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary"/> تقرير المخزون</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">قيمة المخزون الحالية والمنتجات المتوفرة.</CardDescription>
                   </CardHeader>
                    <CardContent className="grid gap-4 p-3 sm:p-6">
                       {/* Inventory Summary */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-center"> {/* Adjusted gap */}
                           <div className="p-2 sm:p-4 bg-muted/60 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">إجمالي قيمة المخزون</p>
                              <p className="text-base sm:text-xl font-bold font-mono">{totalInventoryValue.toFixed(2)}</p>
                           </div>
                            <div className="p-2 sm:p-4 bg-muted/60 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">إجمالي عدد الأصناف</p>
                              <p className="text-base sm:text-xl font-bold font-mono">{inventory.length}</p>
                           </div>
                           {/* Add more summary cards like 'Items Low on Stock' if needed */}
                      </div>

                       {/* Inventory Value Chart */}
                        <Card className="border border-border/40">
                           <CardHeader className="p-3 sm:p-4">
                             <CardTitle className="text-sm sm:text-base">توزيع قيمة المخزون (أعلى 10)</CardTitle>
                           </CardHeader>
                           <CardContent className="flex justify-center p-1 sm:p-2">
                               <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full max-w-lg"> {/* Adjusted height */}
                                 <SafePieChart data={inventoryValueByCategoryData}>
                                   <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                                   <Pie
                                     data={inventoryValueByCategoryData}
                                     dataKey="value"
                                     nameKey="name"
                                     cx="50%"
                                     cy="50%"
                                     outerRadius={80} // Adjusted size
                                     innerRadius={40} // Adjusted size
                                     labelLine={false}
                                     label={({ percent, name }) => percent > 0.04 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''} // Adjusted threshold
                                     fontSize={10} // Smaller font
                                   >
                                     {inventoryValueByCategoryData.map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                     ))}
                                   </Pie>
                                   {/* Conditionally render legend only if there's data */}
                                    {inventoryValueByCategoryData.length > 0 && inventoryValueByCategoryData.length <= 6 && (
                                        <ChartLegend content={<ChartLegendContent nameKey="name" className="text-[10px] sm:text-xs"/>} /> // Smaller legend text
                                    )}
                                 </SafePieChart>
                               </ChartContainer>
                           </CardContent>
                         </Card>

                        {/* Detailed Inventory Table */}
                        <Card className="border border-border/40">
                            <CardHeader className="p-3 sm:p-4">
                                <CardTitle className="text-sm sm:text-base">جرد المخزون التفصيلي</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 sm:p-2">
                                <ScrollArea className="h-[300px] sm:h-[400px] w-full rounded-md border">
                                <Table>
                                    <TableCaption className="text-xs sm:text-sm">{inventory.length === 0 ? 'المخزن فارغ.' : 'قائمة بالمنتجات الحالية في المخزن.'}</TableCaption>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm p-2 sm:p-4">المنتج</TableHead>
                                        <TableHead className="text-center text-xs sm:text-sm p-2 sm:p-4">الكمية</TableHead>
                                        <TableHead className="text-right text-xs sm:text-sm p-2 sm:p-4">السعر</TableHead>
                                        <TableHead className="text-right text-xs sm:text-sm p-2 sm:p-4">الإجمالي</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {inventory.length > 0 ? (
                                        inventory.sort((a, b) => {
                                            const valueA = (typeof a.quantity === 'number' ? a.quantity : 0) * (typeof a.price === 'number' ? a.price : 0);
                                            const valueB = (typeof b.quantity === 'number' ? b.quantity : 0) * (typeof b.price === 'number' ? b.price : 0);
                                            return valueB - valueA;
                                        }).map((product) => (
                                            product && product.id ? ( // Check product and id validity
                                                <TableRow key={product.id}>
                                                    <TableCell className="font-medium text-xs sm:text-sm p-2 sm:p-4">{product.name || 'اسم غير معروف'}</TableCell>
                                                    <TableCell className="text-center font-mono text-xs sm:text-sm p-2 sm:p-4">
                                                        {typeof product.quantity === 'number' ? product.quantity : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs sm:text-sm p-2 sm:p-4">
                                                        {typeof product.price === 'number' ? product.price.toFixed(2) : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs sm:text-sm p-2 sm:p-4">
                                                        {typeof product.quantity === 'number' && typeof product.price === 'number'
                                                            ? (product.quantity * product.price).toFixed(2)
                                                            : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : null // Skip rendering invalid product
                                        ))
                                    ) : (
                                        <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24 text-xs sm:text-sm">
                                            لا توجد منتجات في المخزن لعرضها.
                                        </TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                   </CardContent>
                 </Card>
               </TabsContent>

                {/* Debts Reports */}
               <TabsContent value="debts">
                 <Card className="shadow-lg border border-border/50">
                   <CardHeader className="p-3 sm:p-6 border-b border-border/30">
                     <CardTitle className="text-base sm:text-xl flex items-center gap-2"><Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary"/> تقرير الديون {renderDateRangeLabel()}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">ملخص ديون العملاء والموردين.</CardDescription>
                   </CardHeader>
                   <CardContent className="grid gap-4 p-3 sm:p-6">
                        {/* Debt Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 text-center">
                           <div className="p-2 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">مستحقات (عملاء)</p>
                              <p className="text-base sm:text-xl font-bold font-mono">{totalReceivables.toFixed(2)}</p>
                           </div>
                            <div className="p-2 sm:p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">مدفوعات (موردين)</p>
                              <p className="text-base sm:text-xl font-bold font-mono">{totalPayables.toFixed(2)}</p>
                           </div>
                           <div className={`p-2 sm:p-4 rounded-lg border ${netDebtPosition >= 0 ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800'}`}>
                              <p className="text-xs sm:text-sm text-muted-foreground">صافي الموقف</p>
                              <p className={`text-base sm:text-xl font-bold font-mono ${netDebtPosition >= 0 ? 'text-green-900 dark:text-green-100' : 'text-orange-900 dark:text-orange-100'}`}>
                                 {Math.abs(netDebtPosition).toFixed(2)} {/* Use Math.abs here */}
                                  <span className="text-[10px] sm:text-xs"> {netDebtPosition >= 0 ? '(لصالحك)' : '(عليك)'}</span>
                              </p>
                           </div>
                        </div>

                        {/* Debt Overview Chart */}
                         <Card className="border border-border/40">
                           <CardHeader className="p-3 sm:p-4">
                             <CardTitle className="text-sm sm:text-base">نظرة عامة على الديون</CardTitle>
                           </CardHeader>
                           <CardContent className="flex justify-center p-1 sm:p-2">
                               <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] w-full max-w-xs"> {/* Adjusted height */}
                                 <SafePieChart data={debtOverviewData}>
                                   <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name"/>} />
                                   <Pie data={debtOverviewData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70} paddingAngle={5}> {/* Adjusted size */}
                                      {debtOverviewData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                      ))}
                                   </Pie>
                                    {/* Only render legend if there's data */}
                                    {debtOverviewData.some(d => d.value > 0) && (
                                        <ChartLegend content={<ChartLegendContent nameKey="name" className="mt-2 sm:mt-4 flex-wrap justify-center text-[10px] sm:text-xs"/>} /> {/* Adjusted margin & size */}
                                    )}
                                 </SafePieChart>
                               </ChartContainer>
                           </CardContent>
                         </Card>


                         {/* Detailed Debts Table */}
                         <Card className="border border-border/40">
                            <CardHeader className="p-3 sm:p-4">
                                <CardTitle className="text-sm sm:text-base">كشف حساب المدينين</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 sm:p-2">
                                <ScrollArea className="h-[300px] sm:h-[400px] w-full rounded-md border">
                                <Table>
                                    <TableCaption className="text-xs sm:text-sm">{debtors.length === 0 ? 'لا يوجد مدينون.' : 'قائمة بالمدينين وأرصدتهم الحالية.'}</TableCaption>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm p-2 sm:p-4">الاسم</TableHead>
                                        <TableHead className="text-xs sm:text-sm p-2 sm:p-4">النوع</TableHead>
                                        <TableHead className="text-right text-xs sm:text-sm p-2 sm:p-4">الرصيد الحالي</TableHead>
                                        <TableHead className="text-center text-xs sm:text-sm p-2 sm:p-4">الحالة</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {debtors.length > 0 ? (
                                        debtors.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((debtor) => (
                                            debtor && debtor.id ? ( // Check debtor and id validity
                                                <TableRow key={debtor.id}>
                                                    <TableCell className="font-medium text-xs sm:text-sm p-2 sm:p-4">{debtor.name || 'اسم غير معروف'}</TableCell>
                                                    <TableCell className="text-xs sm:text-sm p-2 sm:p-4">{debtor.type === 'customer' ? 'عميل' : debtor.type === 'supplier' ? 'مورد' : 'غير محدد'}</TableCell>
                                                    <TableCell className={`text-right font-mono font-semibold text-xs sm:text-sm p-2 sm:p-4 ${
                                                        debtor.balance === 0 ? 'text-muted-foreground' :
                                                        (debtor.type === 'customer' && debtor.balance > 0) || (debtor.type === 'supplier' && debtor.balance < 0) ? 'text-red-600 dark:text-red-400' :
                                                        'text-green-600 dark:text-green-400'
                                                      }`}>
                                                        {typeof debtor.balance === 'number' ? Math.abs(debtor.balance).toFixed(2) : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className={`text-center text-[10px] sm:text-xs font-medium p-2 sm:p-4 ${ /* Adjusted size */
                                                        debtor.balance === 0 ? 'text-gray-500' :
                                                        (debtor.type === 'customer' && debtor.balance > 0) ? 'text-red-500' :
                                                        (debtor.type === 'customer' && debtor.balance < 0) ? 'text-green-500' :
                                                        (debtor.type === 'supplier' && debtor.balance < 0) ? 'text-red-500' : // You owe supplier
                                                        'text-green-500' // Supplier owes you / overpaid
                                                    }`}>
                                                         {debtor.balance === 0 ? 'مسدد' :
                                                            (debtor.type === 'customer') ? (debtor.balance > 0 ? 'عليه' : 'له') :
                                                            (debtor.type === 'supplier') ? (debtor.balance < 0 ? 'له' : 'عليه') :
                                                            'غير محدد' // Handle unexpected types
                                                         }
                                                    </TableCell>
                                                </TableRow>
                                            ) : null // Skip rendering invalid debtor
                                        ))
                                    ) : (
                                        <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24 text-xs sm:text-sm">
                                            لا يوجد مدينون لعرضهم.
                                        </TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                   </CardContent>
                 </Card>
               </TabsContent>
             </Tabs>
        </div>
    );
}
