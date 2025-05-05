
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInput,
  useSidebar,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { LogIn, LogOut, User, Building, Phone, Save, Settings, Download, Upload, Sun, Moon, Home, Package, ShoppingCart, CreditCard, FileText } from 'lucide-react'; // Added LogOut, Home and other icons
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { auth } from '@/lib/firebase/config'; // Import auth for signout
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation'; // Import usePathname

// Helper function to load data from localStorage safely
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    if (typeof window === 'undefined') return defaultValue;
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
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
        // Consider adding a toast notification here
    }
};

const LOCALSTORAGE_KEYS = [
    'inventoryProducts',
    'salesInvoices',
    'debtors',
    'debtTransactions',
    'businessName',
    'businessPhone'
];

export default function AppSidebar() {
  const { toast } = useToast();
  const { state: sidebarState } = useSidebar();
  const { theme, setTheme } = useTheme(); // Use theme state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, loading } = useAuth(); // Get user and loading state
  const router = useRouter();
  const pathname = usePathname(); // Get current path

  // Business Details State
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // Load business details on mount
  useEffect(() => {
    setBusinessName(loadFromLocalStorage<string>('businessName', 'نشاطي التجاري'));
    setBusinessPhone(loadFromLocalStorage<string>('businessPhone', ''));
  }, []);

  const handleSaveBusinessDetails = () => {
    saveToLocalStorage('businessName', businessName.trim());
    saveToLocalStorage('businessPhone', businessPhone.trim());
    toast({ title: "تم الحفظ", description: "تم حفظ بيانات النشاط التجاري." });
  };

  // --- Handle Logout ---
  const handleLogout = async () => {
      try {
          await signOut(auth);
          toast({ title: "نجاح", description: "تم تسجيل الخروج بنجاح." });
          router.push('/login'); // Redirect to login page after logout
      } catch (error: any) {
           console.error("Logout failed:", error);
           toast({ title: "خطأ", description: `فشل تسجيل الخروج: ${error.message || 'خطأ غير معروف'}`, variant: "destructive" });
      }
  };

  // --- Backup Logic ---
  const handleBackupData = () => {
      try {
          const backupData: { [key: string]: any } = {};
          LOCALSTORAGE_KEYS.forEach(key => {
               const rawData = localStorage.getItem(key);
               try {
                   backupData[key] = rawData ? JSON.parse(rawData) : null;
               } catch {
                   backupData[key] = rawData;
               }
          });

          const jsonString = JSON.stringify(backupData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
           const dateStr = new Date().toISOString().split('T')[0];
           link.download = `easy-inventory-backup-${dateStr}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast({ title: "نجاح", description: "تم إنشاء ملف النسخ الاحتياطي." });
      } catch (error: any) {
          console.error("Backup failed:", error);
           toast({ title: "خطأ", description: `فشل النسخ الاحتياطي: ${error.message || 'خطأ غير معروف'}`, variant: "destructive" });
      }
  };

  // --- Restore Logic ---
  const handleRestoreData = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
           toast({ title: "خطأ", description: "لم يتم اختيار ملف.", variant: "destructive" });
          return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const jsonString = e.target?.result as string;
              const backupData = JSON.parse(jsonString);

              if (typeof backupData !== 'object' || backupData === null) {
                   throw new Error("ملف النسخ الاحتياطي غير صالح (ليس كائن JSON).");
              }

               let keysRestored = 0;
               Object.keys(backupData).forEach(key => {
                   if (LOCALSTORAGE_KEYS.includes(key)) {
                        const value = backupData[key];
                        localStorage.setItem(key, JSON.stringify(value));
                        keysRestored++;
                   } else {
                       console.warn(`Skipping unexpected key in backup file: ${key}`);
                   }
               });

              if (keysRestored === 0) {
                   throw new Error("لم يتم العثور على بيانات متوقعة في ملف النسخ الاحتياطي.");
              }

               toast({ title: "نجاح", description: "تم استعادة البيانات بنجاح. سيتم إعادة تحميل التطبيق." });

              setTimeout(() => {
                  window.location.reload();
              }, 1500);

          } catch (error: any) {
              console.error("Restore failed:", error);
              toast({ title: "خطأ في الاستعادة", description: `فشل استعادة البيانات: ${error.message || 'الملف غير صالح'}`, variant: "destructive" });
          } finally {
              if (fileInputRef.current) {
                  fileInputRef.current.value = '';
              }
          }
      };
       reader.onerror = (error) => {
            console.error("File reading error:", error);
            toast({ title: "خطأ في قراءة الملف", description: "لم نتمكن من قراءة الملف المحدد.", variant: "destructive" });
             if (fileInputRef.current) {
                 fileInputRef.current.value = '';
            }
       };
      reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <SidebarHeader>
         {sidebarState === 'expanded' && (
            <h2 className="text-xl font-semibold text-primary">Easy Inventory</h2>
         )}
      </SidebarHeader>

      <SidebarSeparator />

       {/* Navigation Links */}
       <SidebarContent className="flex-grow"> {/* Ensure content area grows */}
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/" passHref>
                  <SidebarMenuButton tooltip="الصفحة الرئيسية" isActive={pathname === '/'}>
                  <Home />
                  <span>الرئيسية</span>
                  </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
               <Link href="/inventory" passHref>
                   <SidebarMenuButton tooltip="إدارة المخزون" isActive={pathname.startsWith('/inventory')}>
                   <Package />
                   <span>المخزون</span>
                   </SidebarMenuButton>
               </Link>
             </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/sales" passHref>
                    <SidebarMenuButton tooltip="إدارة المبيعات" isActive={pathname.startsWith('/sales')}>
                    <ShoppingCart />
                    <span>المبيعات</span>
                    </SidebarMenuButton>
                </Link>
             </SidebarMenuItem>
              <SidebarMenuItem>
                 <Link href="/debts" passHref>
                     <SidebarMenuButton tooltip="إدارة الديون" isActive={pathname.startsWith('/debts')}>
                     <CreditCard />
                     <span>الديون</span>
                     </SidebarMenuButton>
                 </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                 <Link href="/reports" passHref>
                     <SidebarMenuButton tooltip="التقارير" isActive={pathname.startsWith('/reports')}>
                     <FileText />
                     <span>التقارير</span>
                     </SidebarMenuButton>
                 </Link>
              </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

       {/* Moved Separator and Groups to Bottom */}
       <SidebarSeparator />

        {/* Business Details */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
             <Building /> بيانات النشاط التجاري
          </SidebarGroupLabel>
           {sidebarState === 'expanded' && (
             <SidebarGroupContent className="space-y-3 px-2 pt-2">
                 <div className="space-y-1">
                   <Label htmlFor="businessName" className="text-xs">اسم النشاط</Label>
                   <Input
                     id="businessName"
                     value={businessName}
                     onChange={(e) => setBusinessName(e.target.value)}
                     placeholder="اسم شركتك أو محلك"
                     className="h-8 text-sm"
                   />
                 </div>
                 <div className="space-y-1">
                   <Label htmlFor="businessPhone" className="text-xs">رقم الهاتف</Label>
                   <Input
                     id="businessPhone"
                     type="tel"
                     value={businessPhone}
                     onChange={(e) => setBusinessPhone(e.target.value)}
                     placeholder="للفواتير والتقارير"
                     className="h-8 text-sm"
                   />
                 </div>
                <Button size="sm" onClick={handleSaveBusinessDetails} className="w-full h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Save className="ml-1 h-3 w-3"/> حفظ البيانات
                </Button>
             </SidebarGroupContent>
           )}
            {sidebarState === 'collapsed' && (
                <SidebarGroupContent className="flex flex-col items-center gap-2 pt-2">
                     <SidebarMenuButton tooltip={businessName || "اسم النشاط التجاري"} size="icon" className="h-8 w-8">
                       <Building />
                     </SidebarMenuButton>
                      <SidebarMenuButton tooltip={businessPhone || "رقم الهاتف"} size="icon" className="h-8 w-8">
                       <Phone />
                     </SidebarMenuButton>
                      <SidebarMenuButton tooltip="حفظ البيانات" size="icon" onClick={handleSaveBusinessDetails} className="h-8 w-8">
                       <Save />
                     </SidebarMenuButton>
                </SidebarGroupContent>
            )}
        </SidebarGroup>

        <SidebarSeparator />

        {/* Settings */}
        <SidebarGroup>
           <SidebarGroupLabel className="flex items-center gap-2">
             <Settings /> الإعدادات
           </SidebarGroupLabel>
           <SidebarMenu>
             {/* Backup */}
             <SidebarMenuItem>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <SidebarMenuButton tooltip="إنشاء نسخة احتياطية محلية لبياناتك">
                            <Download />
                            <span>نسخ احتياطي</span>
                         </SidebarMenuButton>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>تأكيد النسخ الاحتياطي</AlertDialogTitle>
                           <AlertDialogDescription>
                             سيتم إنشاء ملف يحتوي على جميع بياناتك (المخزون، المبيعات، الديون، بيانات النشاط التجاري). احتفظ بهذا الملف في مكان آمن.
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>إلغاء</AlertDialogCancel>
                           <AlertDialogAction onClick={handleBackupData} className="bg-primary hover:bg-primary/90">تأكيد وإنشاء</AlertDialogAction>
                         </AlertDialogFooter>
                     </AlertDialogContent>
                 </AlertDialog>

             </SidebarMenuItem>
              {/* Restore */}
              <SidebarMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <SidebarMenuButton tooltip="استعادة البيانات من ملف نسخ احتياطي">
                            <Upload />
                            <span>استعادة</span>
                         </SidebarMenuButton>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>تحذير الاستعادة</AlertDialogTitle>
                           <AlertDialogDescription>
                                ستؤدي استعادة البيانات إلى استبدال جميع بياناتك الحالية بالبيانات الموجودة في ملف النسخ الاحتياطي. تأكد من اختيار الملف الصحيح. لا يمكن التراجع عن هذه العملية.
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>إلغاء</AlertDialogCancel>
                           <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleRestoreData}
                                accept=".json"
                                style={{ display: 'none' }}
                           />
                           <AlertDialogAction onClick={triggerFileInput} className="bg-destructive hover:bg-destructive/90">اختيار ملف والاستعادة</AlertDialogAction>
                         </AlertDialogFooter>
                     </AlertDialogContent>
                  </AlertDialog>

              </SidebarMenuItem>
               {/* Theme Toggle */}
                 <>
                   <SidebarSeparator className="my-1"/>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setTheme('light')} tooltip="الوضع الفاتح" isActive={theme === 'light'}>
                        <Sun />
                        <span>فاتح</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setTheme('dark')} tooltip="الوضع الداكن" isActive={theme === 'dark'}>
                        <Moon />
                        <span>داكن</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                 </>
           </SidebarMenu>
        </SidebarGroup>

      <SidebarSeparator />

      <SidebarFooter>
         {/* Show User Info/Logout OR Login/Signup */}
         {loading ? (
              <SidebarMenu>
                <SidebarMenuItem>
                     <SidebarMenuButton disabled tooltip="جاري التحميل...">
                         <User className="animate-pulse"/>
                         <span className="animate-pulse">جارٍ التحميل...</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
         ) : user ? (
             <SidebarMenu>
                 <SidebarMenuItem>
                      <SidebarMenuButton tooltip={user.email ?? 'الحساب'} isActive={false}>
                          <User />
                          <span className="truncate">{user.displayName || user.email}</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton onClick={handleLogout} tooltip="تسجيل الخروج" className="text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-700">
                          <LogOut />
                          <span>تسجيل الخروج</span>
                      </SidebarMenuButton>
                 </SidebarMenuItem>
             </SidebarMenu>
         ) : (
            <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/login" passHref>
                         <SidebarMenuButton tooltip="تسجيل الدخول" isActive={pathname === '/login'}>
                            <LogIn />
                            <span>تسجيل الدخول</span>
                         </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                     <Link href="/signup" passHref>
                        <SidebarMenuButton tooltip="إنشاء حساب" isActive={pathname === '/signup'}>
                           <User /> {/* Or a UserPlus icon */}
                           <span>إنشاء حساب</span>
                        </SidebarMenuButton>
                     </Link>
                </SidebarMenuItem>
            </SidebarMenu>
         )}

         {sidebarState === 'expanded' && (
            <div className="p-2 text-xs text-muted-foreground text-center mt-2">
                &copy; {new Date().getFullYear()} Easy Inventory
            </div>
         )}
      </SidebarFooter>
    </>
  );
}
