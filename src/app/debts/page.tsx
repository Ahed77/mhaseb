
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, UserPlus, Search, Contact } from 'lucide-react'; // Removed DollarSign, ArrowRight, TrendingUp, TrendingDown
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation'; // Import useRouter

// Data Structures
interface Debtor {
  id: string;
  name: string;
  type: 'customer' | 'supplier'; // عميل أو مورد
  balance: number; // Positive: customer owes us, Negative: we owe supplier
  phone?: string; // Optional phone number
}

interface DebtTransaction {
  id: string;
  debtorId: string;
  date: string; // ISO string date
  description: string;
  amount: number; // Always positive
  type: 'debt' | 'payment'; // دين أو دفعة
}

export default function DebtsPage() {
  const { toast } = useToast();
  const router = useRouter(); // Initialize router
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [transactions, setTransactions] = useState<DebtTransaction[]>([]);
  const [filteredDebtors, setFilteredDebtors] = useState<Debtor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Loading state

  // Dialog states
  const [isAddMethodDialogOpen, setIsAddMethodDialogOpen] = useState(false); // Dialog to choose add method
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false); // Dialog for manual add

  // Add Debtor Form state
  const [debtorName, setDebtorName] = useState('');
  const [debtorType, setDebtorType] = useState<'customer' | 'supplier'>('customer');
  const [debtorPhone, setDebtorPhone] = useState(''); // Added phone state


  // --- Load Data ---
  useEffect(() => {
    setIsLoading(true);
    let initialDebtors: Debtor[] = [];
    let initialTransactions: DebtTransaction[] = [];

    const storedDebtors = localStorage.getItem('debtors');
    const storedTransactions = localStorage.getItem('debtTransactions');

    if (storedDebtors) {
      try {
          initialDebtors = JSON.parse(storedDebtors);
      } catch (error) {
           console.error("Error parsing debtors from localStorage:", error);
           localStorage.removeItem('debtors'); // Clear corrupted data
      }
    }
    if (storedTransactions) {
       try {
            initialTransactions = JSON.parse(storedTransactions);
       } catch (error) {
           console.error("Error parsing debt transactions from localStorage:", error);
            localStorage.removeItem('debtTransactions'); // Clear corrupted data
       }
    }

    // Calculate initial balances using loaded or default empty transactions
    const updatedDebtorsWithBalance = initialDebtors.map(debtor => ({
        ...debtor,
        balance: calculateBalance(debtor.id, initialTransactions, debtor.type)
    }));

    setDebtors(updatedDebtorsWithBalance);
    setTransactions(initialTransactions);
    setFilteredDebtors(updatedDebtorsWithBalance); // Initialize filtered list
    setIsLoading(false);

  }, []); // Run only once on mount

  // --- Save Debtors ---
  useEffect(() => {
     // Only save if not loading and debtors state is not the initial empty array derived from potentially empty storage
     // This prevents overwriting valid stored data with an empty array on initial load if storage was empty.
     if (!isLoading && (debtors.length > 0 || localStorage.getItem('debtors') !== null)) {
        try {
            localStorage.setItem('debtors', JSON.stringify(debtors));
            console.log("Debtors saved:", debtors); // Debug log
        } catch (error) {
             console.error("Error saving debtors to localStorage:", error);
              toast({ title: "خطأ في الحفظ", description: "حدث خطأ أثناء حفظ بيانات المدينين.", variant: "destructive" });
        }
     }
  }, [debtors, isLoading]); // Depend on debtors and loading state

  // --- Save Transactions ---
   useEffect(() => {
     // Similar logic for transactions: only save if not loading and data exists or existed
     if (!isLoading && (transactions.length > 0 || localStorage.getItem('debtTransactions') !== null)) {
        try {
            localStorage.setItem('debtTransactions', JSON.stringify(transactions));
             console.log("Transactions saved:", transactions); // Debug log
        } catch (error) {
            console.error("Error saving transactions to localStorage:", error);
             toast({ title: "خطأ في الحفظ", description: "حدث خطأ أثناء حفظ بيانات المعاملات.", variant: "destructive" });
        }
     }
   }, [transactions, isLoading]); // Depend on transactions and loading state


    // --- Update Balances & Filtered List ---
   useEffect(() => {
        // Don't run if loading
        if (isLoading) return;

        // Recalculate balances whenever transactions change
        const updatedDebtorsWithBalance = debtors.map(debtor => ({
            ...debtor,
            balance: calculateBalance(debtor.id, transactions, debtor.type)
        }));

         // Check if balances actually changed before setting state to avoid unnecessary re-renders/saves
         // Note: Simple JSON.stringify comparison might be expensive for large datasets.
         // Consider a more efficient deep comparison if performance becomes an issue.
        if (JSON.stringify(debtors) !== JSON.stringify(updatedDebtorsWithBalance)) {
            setDebtors(updatedDebtorsWithBalance);
        }

        // Update the filtered list based on the *potentially* updated debtors and search term
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        setFilteredDebtors(
        updatedDebtorsWithBalance.filter(debtor =>
            debtor.name.toLowerCase().includes(lowerCaseSearchTerm) ||
            (debtor.phone && debtor.phone.includes(lowerCaseSearchTerm))
        )
        );

   }, [transactions, searchTerm, isLoading, debtors]); // React to changes in transactions, search term, loading state, and debtors


  // --- Balance Calculation ---
  const calculateBalance = (debtorId: string, allTransactions: DebtTransaction[], debtorType: 'customer' | 'supplier'): number => {
    const relevantTransactions = allTransactions.filter(t => t.debtorId === debtorId);

    return relevantTransactions.reduce((acc, transaction) => {
      if (debtorType === 'customer') {
        // Customer: Debt increases balance (they owe us more), Payment decreases balance (they paid)
        return transaction.type === 'debt' ? acc + transaction.amount : acc - transaction.amount;
      } else {
        // Supplier: Debt decreases balance (we owe them more), Payment increases balance (we paid them)
        return transaction.type === 'debt' ? acc - transaction.amount : acc + transaction.amount;
      }
    }, 0);
  };

  // --- Handlers ---
  const handleAddDebtor = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = debtorName.trim();
    const trimmedPhone = debtorPhone.trim();

    if (!trimmedName) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المدين.", variant: "destructive" });
      return;
    }

     // Check for duplicate name (optional but good practice)
    if (debtors.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast({ title: "خطأ", description: "اسم المدين موجود بالفعل.", variant: "destructive"});
        return;
    }

    const newDebtor: Debtor = {
      id: `debtor-${Date.now()}`,
      name: trimmedName,
      type: debtorType,
      balance: 0, // Initial balance
      phone: trimmedPhone || undefined, // Save phone number or undefined if empty
    };

    // Update state, triggering useEffect for saving and filtering
    setDebtors(prevDebtors => [...prevDebtors, newDebtor]);

    resetAddDebtorForm();
    setIsAddDebtorDialogOpen(false); // Close manual add dialog
     setIsAddMethodDialogOpen(false); // Ensure method dialog is also closed if open
    toast({ title: "نجاح", description: `تمت إضافة ${trimmedName} بنجاح.` });
  };

   const resetAddDebtorForm = () => {
      setDebtorName('');
      setDebtorType('customer');
      setDebtorPhone('');
   };

   const handleSelectFromContacts = async () => {
       console.log("Attempting to select from contacts...");
       // Check if Contact Picker API is supported
        if ('contacts' in navigator && 'select' in (navigator as any).contacts) { // Use 'as any' for broader compatibility check
           try {
                // Request access to specific properties
                const props = ['name', 'tel'];
                const opts = { multiple: false };
                const contacts = await (navigator as any).contacts.select(props, opts);

                if (contacts.length > 0) {
                    const contact = contacts[0];
                    const contactName = contact.name?.[0] || '';
                    const contactPhone = contact.tel?.[0] || '';

                    // Check if contact already exists (by name or phone)
                    if (debtors.some(d => d.name.toLowerCase() === contactName.toLowerCase() || (d.phone && d.phone === contactPhone && contactPhone))) {
                         toast({ title: "موجود بالفعل", description: `المدين ${contactName} موجود بالفعل في القائمة.`, variant: "default"});
                         setIsAddMethodDialogOpen(false); // Close method dialog
                         return;
                    }

                    setDebtorName(contactName);
                    setDebtorPhone(contactPhone);
                    setIsAddMethodDialogOpen(false); // Close method dialog
                    setIsAddDebtorDialogOpen(true); // Open manual add dialog pre-filled
                    toast({ title: "تم", description: `تم تحديد ${contactName}. أكمل التفاصيل.` });
                } else {
                     // User cancelled the picker
                     toast({ title: "إلغاء", description: "لم يتم اختيار جهة اتصال.", variant: "default" });
                }
           } catch (error) {
                console.error("Error selecting contacts:", error);
                // Check for specific errors like SecurityError or NotAllowedError
                if (error instanceof DOMException && (error.name === 'SecurityError' || error.name === 'NotAllowedError')) {
                     toast({ title: "الإذن مطلوب", description: "يرجى السماح بالوصول إلى جهات الاتصال.", variant: "destructive" });
                } else {
                     toast({ title: "خطأ", description: "لا يمكن الوصول إلى جهات الاتصال. تحقق من الأذونات.", variant: "destructive" });
                }
           }
       } else {
            console.warn("Contact Picker API not supported.");
            toast({ title: "غير مدعوم", description: "ميزة اختيار جهات الاتصال غير مدعومة في هذا المتصفح أو الجهاز.", variant: "destructive" });
       }
   };

   // Calculate total receivables (money owed by customers) and payables (money owed to suppliers)
  const totalReceivables = useMemo(() => {
    // Calculate based on ALL debtors, not just filtered ones for the summary bar
    return debtors
      .filter(d => d.type === 'customer' && d.balance > 0)
      .reduce((sum, d) => sum + d.balance, 0);
  }, [debtors]); // Depend on the full debtors list

  const totalPayables = useMemo(() => {
    // Payables are represented by negative balances for suppliers
    // Calculate based on ALL debtors
    return debtors
      .filter(d => d.type === 'supplier' && d.balance < 0)
      .reduce((sum, d) => sum + Math.abs(d.balance), 0);
  }, [debtors]); // Depend on the full debtors list


   if (isLoading) {
     return <div className="container mx-auto p-4 text-center">جارٍ تحميل البيانات...</div>;
   }


  return (
    <div className="container mx-auto p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">إدارة الديون</h1>
        <p className="text-muted-foreground">تتبع ديون العملاء والموردين.</p>
      </header>

      {/* Action Buttons and Search */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">

        {/* Choose Add Method Dialog */}
        <Dialog open={isAddMethodDialogOpen} onOpenChange={setIsAddMethodDialogOpen}>
            <DialogTrigger asChild>
                 <Button className="btn-animated bg-accent hover:bg-accent/90 text-accent-foreground w-full md:w-auto">
                   <PlusCircle className="ml-2 h-4 w-4" /> إضافة مدين
                 </Button>
            </DialogTrigger>
             <DialogContent className="sm:max-w-[350px]">
                <DialogHeader>
                    <DialogTitle>طريقة إضافة المدين</DialogTitle>
                    <DialogDescription>اختر طريقة إضافة المدين الجديد.</DialogDescription>
                </DialogHeader>
                 <div className="grid gap-4 py-4">
                     <Button variant="outline" onClick={handleSelectFromContacts} className="w-full justify-start btn-animated">
                       <Contact className="ml-2 h-5 w-5" />
                       اختيار من جهات الاتصال
                     </Button>
                     <Button variant="outline" onClick={() => { setIsAddMethodDialogOpen(false); setIsAddDebtorDialogOpen(true); resetAddDebtorForm(); }} className="w-full justify-start btn-animated">
                       <UserPlus className="ml-2 h-5 w-5" />
                       إضافة يدوياً
                     </Button>
                 </div>
                 <DialogFooter>
                     <DialogClose asChild>
                         <Button type="button" variant="ghost">إلغاء</Button>
                     </DialogClose>
                 </DialogFooter>
             </DialogContent>
        </Dialog>

         {/* Manual Add Debtor Dialog */}
        <Dialog open={isAddDebtorDialogOpen} onOpenChange={(open) => {setIsAddDebtorDialogOpen(open); if (!open) resetAddDebtorForm(); }}>
          {/* Trigger is now handled by the Add Method Dialog */}
          {/* <DialogTrigger asChild> ... </DialogTrigger> */}
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>إضافة مدين يدوياً</DialogTitle>
              <DialogDescription>أدخل تفاصيل العميل أو المورد الجديد.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddDebtor} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="debtorName" className="text-right">
                  الاسم
                </Label>
                <Input
                  id="debtorName"
                  value={debtorName}
                  onChange={(e) => setDebtorName(e.target.value)}
                  className="col-span-3"
                  required
                  aria-required="true"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="debtorPhone" className="text-right">
                   الهاتف
                 </Label>
                 <Input
                   id="debtorPhone"
                   type="tel" // Use tel type for phone numbers
                   value={debtorPhone}
                   onChange={(e) => setDebtorPhone(e.target.value)}
                   className="col-span-3"
                   placeholder="اختياري"
                 />
               </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="debtorType" className="text-right">
                  النوع
                </Label>
                <Select value={debtorType} onValueChange={(value: 'customer' | 'supplier') => setDebtorType(value)} required aria-required="true">
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="customer">عميل</SelectItem>
                        <SelectItem value="supplier">مورد</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                   <Button type="button" variant="outline">إلغاء</Button>
                 </DialogClose>
                <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground btn-animated">إضافة المدين</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>


        {/* Search Input */}
        <div className="relative w-full md:w-1/3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search" // Use search type for better semantics
              placeholder="ابحث بالاسم أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-label="Search debtors"
            />
        </div>
      </div>

        {/* Debt Summary Bar */}
       <Card className="mb-6 shadow-md overflow-hidden"> {/* Added overflow-hidden */}
            <CardContent className="p-0"> {/* Remove padding */}
                 <div className="flex w-full h-16 text-sm md:text-base"> {/* Adjust height and text size */}
                    {/* Receivables Section (Blue - what others owe you) */}
                    <div className="flex-1 bg-blue-100 dark:bg-blue-900/50 flex flex-col justify-center items-center p-2 md:p-3 text-center border-l border-blue-300 dark:border-blue-700">
                         <span className="text-xs md:text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">إجمالي المستحقات (لك)</span>
                         <div className="text-lg md:text-xl font-bold text-blue-800 dark:text-blue-200 font-mono">{totalReceivables.toFixed(2)}</div>
                    </div>
                    {/* Payables Section (Red - what you owe others) */}
                     <div className="flex-1 bg-red-100 dark:bg-red-900/50 flex flex-col justify-center items-center p-2 md:p-3 text-center">
                        <span className="text-xs md:text-sm font-medium text-red-700 dark:text-red-300 mb-1">إجمالي المدفوعات (عليك)</span>
                         <div className="text-lg md:text-xl font-bold text-red-800 dark:text-red-200 font-mono">{totalPayables.toFixed(2)}</div>
                    </div>
                </div>
            </CardContent>
        </Card>


      {/* Debtors Table Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>قائمة المدينين</CardTitle>
           <CardDescription>انقر على اسم المدين لعرض التفاصيل وإضافة معاملات.</CardDescription> {/* Updated description */}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border">
            <Table>
              <TableCaption>{debtors.length === 0 ? 'لا يوجد مدينون مسجلون بعد.' : (filteredDebtors.length === 0 ? 'لا يوجد مدينون يطابقون بحثك.' : 'قائمة بالعملاء والموردين.')}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                   <TableHead className="hidden sm:table-cell">الهاتف</TableHead> {/* Hide on small screens */}
                  <TableHead>النوع</TableHead>
                  <TableHead className="text-right">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDebtors.length > 0 ? (
                  filteredDebtors.map((debtor) => (
                     <TableRow
                        key={debtor.id}
                        className="cursor-pointer hover:bg-muted/60 transition-colors" // Added transition
                        onClick={() => router.push(`/debts/${debtor.id}`)} // Navigate on row click
                        tabIndex={0} // Make row focusable
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/debts/${debtor.id}`) }} // Allow keyboard navigation
                      >
                      <TableCell className="font-medium">
                         {/* Make name stand out */}
                         <span className="text-primary hover:underline">
                            {debtor.name}
                         </span>
                      </TableCell>
                       <TableCell className="hidden sm:table-cell text-muted-foreground font-mono">{debtor.phone || '-'}</TableCell> {/* Show phone or dash */}
                      <TableCell>{debtor.type === 'customer' ? 'عميل' : 'مورد'}</TableCell>
                       <TableCell className={`text-right font-semibold font-mono ${
                           debtor.balance === 0 ? 'text-muted-foreground' :
                           (debtor.type === 'customer' && debtor.balance > 0) || (debtor.type === 'supplier' && debtor.balance < 0) ? 'text-red-600 dark:text-red-400' : // Owed by customer / Owed to supplier (Bad for us)
                           'text-green-600 dark:text-green-400' // Overpaid customer / Overpaid supplier (Good for us)
                       }`}>
                           {Math.abs(debtor.balance).toFixed(2)}
                           {/* Concise Balance Description Tooltips or small text */}
                            {debtor.balance !== 0 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                    ({debtor.type === 'customer' ? (debtor.balance > 0 ? 'عليه' : 'له') : (debtor.balance < 0 ? 'له' : 'عليه')})
                                </span>
                            )}
                           {debtor.balance === 0 && <span className="text-xs text-muted-foreground ml-1">(مسدد)</span>}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                      {searchTerm ? 'لا يوجد مدينون يطابقون بحثك.' : 'لا يوجد مدينون لعرضهم. ابدأ بإضافة مدين جديد.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

