
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ArrowRightLeft, ArrowLeft, Calendar, Share2, Printer, PlusCircle, DollarSign, Phone, MessageSquare } from 'lucide-react'; // Added Phone, MessageSquare
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { format } from 'date-fns'; // Import date-fns for formatting
import { arEG } from 'date-fns/locale'; // Import Arabic locale
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog'; // Added Dialog components
import { Input } from '@/components/ui/input'; // Added Input
import { Label } from '@/components/ui/label'; // Added Label
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select components
import { Textarea } from '@/components/ui/textarea'; // Added Textarea for notes


// Re-use or import interfaces
interface Debtor {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  balance: number; // Recalculated on this page based on transactions
  phone?: string; // Added optional phone
}

interface DebtTransaction {
  id: string;
  debtorId: string;
  date: string; // ISO string date
  description: string;
  amount: number; // Always positive
  type: 'debt' | 'payment';
}

// Helper function to load data from localStorage safely
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    if (typeof window === 'undefined') return defaultValue; // Guard for SSR
    try {
        const storedValue = localStorage.getItem(key);
        return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
        console.error(`Error loading ${key} from localStorage:`, error);
        localStorage.removeItem(key); // Clear corrupted data
        return defaultValue;
    }
};

// Helper function to save data to localStorage safely
const saveToLocalStorage = <T,>(key: string, data: T) => {
    if (typeof window === 'undefined') return; // Guard for SSR
     try {
         localStorage.setItem(key, JSON.stringify(data));
     } catch (error) {
          console.error(`Error saving ${key} to localStorage:`, error);
          // Optionally notify the user or implement fallback
     }
};


export default function DebtorDetailPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const debtorId = params.debtorId as string;

  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [transactions, setTransactions] = useState<DebtTransaction[]>([]); // Only this debtor's transactions
  const [isLoading, setIsLoading] = useState(true);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);

   // Add Transaction Form state
  const [transactionNote, setTransactionNote] = useState(''); // Changed from description to note
  const [transactionAmount, setTransactionAmount] = useState<number | ''>('');
  const [transactionType, setTransactionType] = useState<'debt' | 'payment'>('debt'); // Default to 'debt'
  const [transactionDate, setTransactionDate] = useState<Date>(new Date()); // Default to now, allow change


  // --- Balance Calculation Helper ---
    const calculateBalance = (
      debtorType: 'customer' | 'supplier',
      currentTransactions: DebtTransaction[] // Use only the debtor's transactions passed to it
    ): number => {
      return currentTransactions.reduce((acc, transaction) => {
          if (debtorType === 'customer') {
              // Customer owes us: debt is positive, payment is negative
              return transaction.type === 'debt' ? acc + transaction.amount : acc - transaction.amount;
          } else { // supplier
               // We owe supplier: debt is negative, payment is positive
              return transaction.type === 'debt' ? acc - transaction.amount : acc + transaction.amount;
          }
      }, 0);
  };


  // --- Data Loading ---
  useEffect(() => {
      setIsLoading(true);
      const allDebtors = loadFromLocalStorage<Debtor[]>('debtors', []);
      const allTransactions = loadFromLocalStorage<DebtTransaction[]>('debtTransactions', []);

      const currentDebtorData = allDebtors.find(d => d.id === debtorId);

      if (currentDebtorData) {
          const debtorTransactions = allTransactions
              .filter(t => t.debtorId === debtorId)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending

          const calculatedBalance = calculateBalance(currentDebtorData.type, debtorTransactions);

          setDebtor({ ...currentDebtorData, balance: calculatedBalance }); // Update balance in state
          setTransactions(debtorTransactions); // Set only this debtor's transactions

      } else {
          toast({ title: "خطأ", description: "لم يتم العثور على المدين.", variant: "destructive" });
          router.push('/debts'); // Redirect if debtor not found
      }
      setIsLoading(false);
  }, [debtorId, router, toast]); // Depend only on debtorId for initial load


   // Calculate progress bar data based on the debtor's transactions
   const progressBarData = useMemo(() => {
    if (!debtor || transactions.length === 0) return { value: 0, totalDebt: 0, totalPayments: 0, isSettled: false };

    const totalDebtAmount = transactions
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPaymentAmount = transactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);

    let progress = 0;
    let isSettled = false;
    const calculatedBalance = debtor.balance; // Use the balance already calculated and stored in debtor state

    if (debtor.type === 'customer') {
        // Customer owes us (positive balance means debt)
        if (totalDebtAmount > 0) {
            progress = (totalPaymentAmount / totalDebtAmount) * 100;
        } else if (totalPaymentAmount > 0 && totalDebtAmount === 0) {
             // Only payments recorded, no debt ever - considered settled/overpaid
             progress = 100;
        } else {
             // No debts and no payments, or balance is somehow negative without debts (overpaid)
             progress = (calculatedBalance <= 0) ? 100 : 0;
        }
        isSettled = calculatedBalance <= 0;
    } else { // Supplier
        // We owe them (negative balance means debt)
        if (totalDebtAmount > 0) { // Debt here means we received goods/services on credit
            // Progress represents how much we paid back towards what we received on credit
            progress = (totalPaymentAmount / totalDebtAmount) * 100;
        } else if (totalPaymentAmount > 0 && totalDebtAmount === 0) {
             // Only payments made, no debt ever recorded (prepayment?) - considered settled
             progress = 100;
        } else {
            // No debts and no payments, or balance is somehow positive without debts (they owe us?)
            progress = (calculatedBalance >= 0) ? 100 : 0;
        }
        isSettled = calculatedBalance >= 0;
    }

       return {
         value: Math.min(Math.max(progress, 0), 100), // Clamp between 0 and 100
         totalDebt: totalDebtAmount,
         totalPayments: totalPaymentAmount,
         isSettled: isSettled
       };
   }, [debtor, transactions]);


   // --- Add Transaction Handler ---
    const handleAddTransaction = (e: React.FormEvent) => {
        e.preventDefault();
        if (!debtor || transactionAmount === '' || Number(transactionAmount) <= 0 || !transactionNote.trim()) {
          toast({ title: "خطأ", description: "يرجى ملء المبلغ والملاحظة بقيم صحيحة.", variant: "destructive" });
          return;
        }

         const amount = Number(transactionAmount);

        const newTransaction: DebtTransaction = {
            id: `trans-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, // More unique ID
            debtorId: debtor.id, // Use the current debtor's ID
            date: transactionDate.toISOString(), // Use selected date
            description: transactionNote.trim(),
            amount: amount,
            type: transactionType,
        };

        // 1. Load the *entire* list of transactions from storage
        const allTransactions = loadFromLocalStorage<DebtTransaction[]>('debtTransactions', []);

        // 2. Add the new transaction to the full list
        const updatedAllTransactions = [...allTransactions, newTransaction];

        // 3. Save the *entire* updated list back to storage
        saveToLocalStorage('debtTransactions', updatedAllTransactions);
        console.log("All Transactions saved after add:", updatedAllTransactions); // Debug log

        // 4. Update local state for immediate UI feedback (only this debtor's transactions)
         const updatedDebtorTransactions = updatedAllTransactions
             .filter(t => t.debtorId === debtor.id)
             .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort again

        setTransactions(updatedDebtorTransactions);

         // 5. Recalculate and update debtor's balance in the local state
        const newBalance = calculateBalance(debtor.type, updatedDebtorTransactions);
        setDebtor({ ...debtor, balance: newBalance });


        // Reset form and close dialog
        setTransactionNote('');
        setTransactionAmount('');
        setTransactionType('debt');
         setTransactionDate(new Date()); // Reset date to now
        setIsAddTransactionDialogOpen(false);
        toast({ title: "نجاح", description: "تمت إضافة المعاملة بنجاح." });
    };

   // --- Action Handlers (Share, Print, Call, Message) ---
   const handleShareDetails = () => {
    if (!debtor) return;

    const balanceText = getBalanceText(debtor); // Use helper function
    const businessName = loadFromLocalStorage<string>('businessName', ''); // Load business name
    const businessPhone = loadFromLocalStorage<string>('businessPhone', ''); // Load business phone

    const shareText = `${businessName ? `${businessName}\n` : ''}` +
                      `${businessPhone ? `الهاتف: ${businessPhone}\n` : ''}` +
                      `--------------------\n` +
                      `تفاصيل حساب: ${debtor.name} (${debtor.type === 'customer' ? 'عميل' : 'مورد'})\n` +
                      `هاتف المدين: ${debtor.phone || 'غير متوفر'}\n` +
                      `--------------------\n` +
                      `الرصيد الحالي: ${balanceText}\n` +
                      `إجمالي الديون المسجلة: ${progressBarData.totalDebt.toFixed(2)}\n` +
                      `إجمالي الدفعات المسجلة: ${progressBarData.totalPayments.toFixed(2)}\n` +
                      `--------------------\n` +
                      `آخر المعاملات:\n` +
                      transactions.slice(0, 10).map(t => // Show last 10 transactions
                          `- ${format(new Date(t.date), 'yy/MM/dd')}: ${t.description} (${t.type === 'debt' ? 'دين' : 'دفعة'}) - ${t.amount.toFixed(2)}`
                      ).join('\n') +
                      (transactions.length > 10 ? '\n...' : ''); // Indicate if more transactions exist


    if (navigator.share) {
      navigator.share({
        title: `تفاصيل حساب ${debtor.name}`,
        text: shareText,
      })
      .then(() => toast({ title: "نجاح", description: "تمت مشاركة تفاصيل الحساب." }))
      .catch((error) => {
          console.error("Share error:", error);
           if (error.name !== 'AbortError') {
                toast({ title: "خطأ", description: `لم تتم المشاركة: ${error.message || error}`, variant: 'destructive' });
            }
      });
    } else {
      navigator.clipboard.writeText(shareText)
        .then(() => toast({ title: "تم النسخ", description: "تم نسخ تفاصيل الحساب إلى الحافظة." }))
        .catch(() => toast({ title: "خطأ", description: "فشل نسخ التفاصيل.", variant: 'destructive' }));
    }
  };

   const handlePrintDetails = () => {
     if (!debtor) return;

     const balanceText = getBalanceText(debtor); // Use helper function
     const businessName = loadFromLocalStorage<string>('businessName', 'Easy Inventory'); // Load business name
     const businessPhone = loadFromLocalStorage<string>('businessPhone', ''); // Load business phone
     const printDate = format(new Date(), 'yyyy/MM/dd HH:mm', { locale: arEG });

    const printContent = `
      <html>
      <head>
        <title>كشف حساب - ${debtor.name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; font-size: 10pt; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
          .header h1 { margin: 0; font-size: 16pt; color: #333; }
          .header h2 { margin: 5px 0; font-size: 12pt; color: #555; }
          .header .business-info { font-size: 9pt; color: #666; margin-bottom: 10px; }
          .details { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 5px; background-color: #f9f9f9;}
          .details p { margin: 5px 0; font-size: 11pt; }
          .details span { font-weight: bold; }
          .details .phone { font-size: 10pt; color: #666; }
          .totals { margin-top: 10px; font-size: 9pt; color: #555; display: flex; justify-content: space-around; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 9pt; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; vertical-align: top; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8f8f8; }
          .balance-summary { margin-top: 25px; padding-top: 15px; border-top: 2px solid #ccc; text-align: center; }
          .balance-summary p { font-weight: bold; font-size: 13pt; }
          .footer { text-align: center; margin-top: 40px; font-size: 8pt; color: #aaa; }
          .amount-col { font-family: 'Courier New', Courier, monospace; white-space: nowrap; } /* Monospaced for amounts */
          .date-col { white-space: nowrap; }
           @page { size: A4; margin: 1.5cm; }
           @media print {
             body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none; }
           }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="business-info">
            <h1>${businessName}</h1>
            ${businessPhone ? `<p>${businessPhone}</p>` : ''}
          </div>
          <h2>كشف حساب</h2>
          <h3>${debtor.name} (${debtor.type === 'customer' ? 'عميل' : 'مورد'})</h3>
        </div>
        <div class="details">
          <p>${balanceText}</p>
           ${debtor.phone ? `<p class="phone">هاتف المدين: <span>${debtor.phone}</span></p>` : ''}
          <div class="totals">
            <span>إجمالي الديون المسجلة: <strong>${progressBarData.totalDebt.toFixed(2)}</strong></span> |
            <span>إجمالي الدفعات المسجلة: <strong>${progressBarData.totalPayments.toFixed(2)}</strong></span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="date-col">التاريخ والوقت</th>
              <th>الملاحظة</th>
              <th>نوع المعاملة</th>
              <th class="amount-col">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (t) => `
              <tr>
                <td class="date-col">${format(new Date(t.date), 'yyyy/MM/dd HH:mm')}</td>
                <td>${t.description}</td>
                <td style="font-weight: bold; color: ${t.type === 'debt' ? '#d9534f' : '#5cb85c'};">${t.type === 'debt' ? 'دين' : 'دفعة'}</td>
                <td class="amount-col">${t.amount.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
             ${transactions.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #888; padding: 20px;">-- لا توجد معاملات مسجلة --</td></tr>' : ''}
          </tbody>
        </table>
         <div class="balance-summary">
             <p>${balanceText}</p>
         </div>
         <div class="footer">
             تم إنشاؤه في ${printDate}
         </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
     if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
         setTimeout(() => {
            try {
                printWindow.print();
            } catch (error) {
                console.error("Print error:", error);
                toast({ title: "خطأ طباعة", description: "فشل بدء عملية الطباعة.", variant: "destructive" });
                printWindow.close();
            }
        }, 500);
        toast({ title: "تم", description: "يتم تحضير كشف الحساب للطباعة." });
     } else {
         toast({ title: "خطأ", description: "فشل فتح نافذة الطباعة. يرجى تعطيل مانع النوافذ المنبثقة.", variant: "destructive" });
     }
  };

   // Helper to get balance text
    const getBalanceText = (d: Debtor): string => {
       const absBalance = Math.abs(d.balance).toFixed(2);
       if (d.balance === 0) {
           return `الرصيد: 0.00 (مسدد)`;
       } else if (d.type === 'customer') {
           return d.balance > 0 ? `مستحق عليه: ${absBalance}` : `رصيد دائن له: ${absBalance}`;
       } else { // supplier
           return d.balance < 0 ? `مستحق له: ${absBalance}` : `رصيد مدين لك: ${absBalance}`;
       }
   };

   const handleCall = () => {
       if (debtor?.phone) {
            window.location.href = `tel:${debtor.phone}`;
       } else {
            toast({ title: "لا يوجد رقم", description: "لم يتم تسجيل رقم هاتف لهذا المدين.", variant: "destructive" });
       }
   };

    const handleSendMessage = () => {
        if (debtor?.phone) {
             const messageBody = encodeURIComponent(`مرحبًا ${debtor.name},\nتذكير بخصوص الحساب...\nالرصيد الحالي: ${getBalanceText(debtor)}`);
             window.location.href = `sms:${debtor.phone}?body=${messageBody}`;
        } else {
             toast({ title: "لا يوجد رقم", description: "لم يتم تسجيل رقم هاتف لهذا المدين.", variant: "destructive" });
        }
    };


  if (isLoading) {
    return <div className="container mx-auto p-4 text-center">
        <div className="animate-pulse">جارٍ التحميل...</div>
    </div>;
  }

  if (!debtor) {
    // This case should ideally not be reached due to the redirect in useEffect, but it's a good fallback.
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        لم يتم العثور على المدين المحدد.
        <Link href="/debts" className="block mt-4">
            <Button variant="outline">
                <ArrowLeft className="ml-2 h-4 w-4" /> العودة إلى قائمة الديون
            </Button>
        </Link>
      </div>
    );
  }

  // Determine balance label based on debtor type and balance value
   const balanceLabel = debtor.type === 'customer'
    ? (debtor.balance > 0 ? 'مستحق عليه (مدين)' : debtor.balance < 0 ? 'رصيد له (دائن)' : 'الرصيد مسدد')
    : (debtor.balance < 0 ? 'مستحق له (دائن)' : debtor.balance > 0 ? 'رصيد عليه (مدين)' : 'الرصيد مسدد');

   // Determine balance color based on who owes whom
   const balanceColorClass = debtor.balance === 0
        ? 'text-muted-foreground'
        : (debtor.type === 'customer' && debtor.balance > 0) || (debtor.type === 'supplier' && debtor.balance < 0)
        ? 'text-red-600 dark:text-red-400' // Owed by customer / Owed to supplier (Bad for us)
        : 'text-green-600 dark:text-green-400'; // Overpaid customer / Supplier owes us (Good for us)


  return (
    <div className="container mx-auto p-4">
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div className="flex-grow">
            <h1 className="text-3xl font-bold text-primary">{debtor.name}</h1>
            <p className="text-muted-foreground">{debtor.type === 'customer' ? 'عميل' : 'مورد'} {debtor.phone && ` - ${debtor.phone}`}</p>
        </div>
         <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
             {/* Add Transaction Dialog Trigger */}
             <Dialog open={isAddTransactionDialogOpen} onOpenChange={(open) => { setIsAddTransactionDialogOpen(open); if (!open) { setTransactionNote(''); setTransactionAmount(''); setTransactionType('debt'); setTransactionDate(new Date()); } }}>
                 <DialogTrigger asChild>
                    <Button className="btn-animated bg-accent hover:bg-accent/90 text-accent-foreground">
                        <PlusCircle className="ml-2 h-4 w-4" /> إضافة معاملة
                    </Button>
                 </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]"> {/* Slightly wider */}
                     <DialogHeader>
                        <DialogTitle>إضافة معاملة لـ {debtor.name}</DialogTitle>
                        <DialogDescription>سجل دين جديد أو دفعة لهذا {debtor.type === 'customer' ? 'العميل' : 'المورد'}.</DialogDescription>
                     </DialogHeader>
                     <form onSubmit={handleAddTransaction} className="grid gap-4 py-4">
                         {/* Transaction Type Select */}
                         <div className="grid grid-cols-4 items-center gap-4">
                             <Label htmlFor="transactionType" className="text-right pt-1">
                                 النوع
                             </Label>
                             <Select value={transactionType} onValueChange={(value: 'debt' | 'payment') => setTransactionType(value)}>
                                 <SelectTrigger id="transactionType" className="col-span-3">
                                     <SelectValue placeholder="اختر نوع المعاملة" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     <SelectItem value="debt">
                                         دين ({debtor.type === 'customer' ? 'عليه' : 'لنا'})
                                     </SelectItem>
                                     <SelectItem value="payment">
                                         دفعة ({debtor.type === 'customer' ? 'منه' : 'له'})
                                     </SelectItem>
                                 </SelectContent>
                             </Select>
                         </div>
                         {/* Amount Input */}
                         <div className="grid grid-cols-4 items-center gap-4">
                             <Label htmlFor="transactionAmount" className="text-right pt-1">
                                 المبلغ
                             </Label>
                             <Input
                                 id="transactionAmount"
                                 type="number"
                                 step="0.01"
                                 min="0.01"
                                 value={transactionAmount}
                                 onChange={(e) => setTransactionAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                 className="col-span-3"
                                 required
                                 aria-required="true"
                                 placeholder='0.00'
                             />
                         </div>
                          {/* Note Input */}
                         <div className="grid grid-cols-4 items-start gap-4"> {/* Changed to items-start */}
                             <Label htmlFor="transactionNote" className="text-right pt-1">
                                 الملاحظة
                             </Label>
                             <Textarea
                                 id="transactionNote"
                                 value={transactionNote}
                                 onChange={(e) => setTransactionNote(e.target.value)}
                                 className="col-span-3 min-h-[80px]" // Ensure decent height
                                 placeholder="e.g., فاتورة رقم 123, دفعة مقدمة..."
                                 required
                                 aria-required="true"
                             />
                         </div>
                          {/* Date Input */}
                         <div className="grid grid-cols-4 items-center gap-4">
                             <Label htmlFor="transactionDate" className="text-right pt-1">
                                 التاريخ
                             </Label>
                             <Input
                                type="datetime-local" // Use datetime-local for date and time input
                                id="transactionDate"
                                value={format(transactionDate, "yyyy-MM-dd'T'HH:mm")} // Format for input
                                onChange={(e) => setTransactionDate(new Date(e.target.value))}
                                className="col-span-3"
                                required
                                aria-required="true"
                            />
                         </div>

                         <DialogFooter className="mt-2">
                             <DialogClose asChild>
                                 <Button type="button" variant="outline">إلغاء</Button>
                             </DialogClose>
                             <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground btn-animated">إضافة المعاملة</Button>
                         </DialogFooter>
                     </form>
                 </DialogContent>
             </Dialog>
            <Link href="/debts">
                <Button variant="outline" className="btn-animated">
                    <ArrowLeft className="ml-2 h-4 w-4" /> العودة للقائمة
                </Button>
            </Link>
        </div>
      </header>

      {/* Balance and Progress Card */}
       <Card className="mb-6 shadow-md border border-border">
            <CardHeader>
                <CardTitle>ملخص الحساب المالي</CardTitle>
                <CardDescription>
                     الرصيد الحالي ونسبة تسديد الديون لهذا {debtor.type === 'customer' ? 'العميل' : 'المورد'}.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6"> {/* Increased gap */}
                 <div className="flex flex-col sm:flex-row justify-between items-center bg-muted/50 p-4 rounded-md gap-2">
                     <span className="text-lg font-medium">{balanceLabel}:</span>
                     <span className={`text-2xl font-bold font-mono ${balanceColorClass}`}>
                        {Math.abs(debtor.balance).toFixed(2)}
                    </span>
                </div>
                {/* Progress Bar Section - Conditionally render if there's debt or payments */}
                 {(progressBarData.totalDebt > 0 || progressBarData.totalPayments > 0 || debtor.balance !== 0) && (
                     <div className="mt-2 space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground mb-1 font-mono">
                             <span>إجمالي الدفعات: {progressBarData.totalPayments.toFixed(2)}</span>
                             <span>إجمالي الديون: {progressBarData.totalDebt.toFixed(2)}</span>
                        </div>
                        <Progress
                            value={progressBarData.value}
                             className={`h-3 [&>div]:bg-gradient-to-r ${
                                progressBarData.isSettled
                                    ? '[&>div]:from-green-400 [&>div]:to-green-600'
                                    : (progressBarData.value > 50
                                        ? '[&>div]:from-yellow-400 [&>div]:to-yellow-600'
                                        : '[&>div]:from-red-400 [&>div]:to-red-600')
                            }`}
                            aria-label={`نسبة السداد ${progressBarData.value.toFixed(0)}%`}
                        />
                         <p className={`text-center text-sm mt-1 font-medium ${progressBarData.isSettled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                           {progressBarData.isSettled ? 'تم تسديد المبلغ المستحق بالكامل أو يوجد رصيد دائن' : `نسبة السداد: ${progressBarData.value.toFixed(0)}%`}
                         </p>
                    </div>
                )}
                {/* Only show message if no debt or payments recorded and balance is zero */}
                 {progressBarData.totalDebt === 0 && progressBarData.totalPayments === 0 && debtor.balance === 0 && (
                     <p className="text-center text-muted-foreground py-4">لا توجد ديون أو دفعات مسجلة لهذا الحساب حتى الآن.</p>
                 )}

            </CardContent>
              <CardFooter className="flex flex-wrap justify-center sm:justify-end gap-2 border-t pt-4">
                  {debtor.phone && (
                     <>
                         <Button variant="outline" onClick={handleCall} className="btn-animated">
                            <Phone className="ml-2 h-4 w-4"/> اتصال
                         </Button>
                          <Button variant="outline" onClick={handleSendMessage} className="btn-animated">
                            <MessageSquare className="ml-2 h-4 w-4"/> رسالة نصية
                         </Button>
                     </>
                  )}
                 <Button variant="outline" onClick={handleShareDetails} className="btn-animated">
                    <Share2 className="ml-2 h-4 w-4"/> مشاركة
                 </Button>
                 <Button variant="outline" onClick={handlePrintDetails} className="btn-animated">
                    <Printer className="ml-2 h-4 w-4"/> طباعة
                 </Button>
             </CardFooter>
        </Card>


      {/* Transactions Table Card */}
      <Card className="shadow-lg border border-border">
        <CardHeader>
          <CardTitle>سجل المعاملات</CardTitle>
           <CardDescription>جميع عمليات الديون والدفعات المسجلة (الأحدث أولاً).</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[450px] w-full rounded-md border">
            <Table>
              <TableCaption>{transactions.length === 0 ? 'لا توجد معاملات مسجلة بعد.' : 'قائمة بالمعاملات مرتبة حسب التاريخ (الأحدث أولاً).'}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]"> <Calendar className="inline-block ml-1 h-4 w-4"/> التاريخ والوقت</TableHead>
                  <TableHead>الملاحظة</TableHead>
                   <TableHead className="text-center"><ArrowRightLeft className="inline-block ml-1 h-4 w-4"/> النوع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap text-xs sm:text-sm">{format(new Date(transaction.date), 'yyyy/MM/dd HH:mm')}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                       <TableCell className={`text-center font-medium ${transaction.type === 'debt' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {transaction.type === 'debt' ? 'دين' : 'دفعة'}
                      </TableCell>
                      <TableCell className="text-right font-mono">{transaction.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                      لا توجد معاملات لعرضها. قم بإضافة معاملة جديدة باستخدام الزر أعلاه.
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
