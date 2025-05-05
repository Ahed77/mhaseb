
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, ShoppingCart, CreditCard, FileText } from 'lucide-react';
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter

export default function Home() {
    const { user, loading } = useAuth();
    const router = useRouter();

    // Redirect logged-in users away from the landing page
    // useEffect(() => {
    //    // Don't redirect while loading or if already navigating
    //    if (!loading && user) {
    //      console.log("User logged in, redirecting from Home to /inventory");
    //      router.push('/inventory'); // Or '/reports' or another relevant page
    //    } else if (!loading && !user) {
    //        // Optionally redirect logged-out users to login if they land here
    //        // console.log("User not logged in, redirecting from Home to /login");
    //        // router.push('/login');
    //    }
    // }, [user, loading, router]);

    // Show loading state or null if redirecting
    // if (loading || user) {
    //     return null; // Or a loading spinner
    // }


  // Render page content if user is logged in (or loading - handled by AuthProvider)
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] py-2"> {/* Adjusted min-height */}
      <header className="w-full max-w-4xl mb-10 md:mb-12 text-center"> {/* Adjusted margin */}
        <h1 className="text-3xl md:text-4xl font-bold text-primary mt-4 md:mt-0">Easy Inventory</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">إدارة المخزون والمبيعات والديون بسهولة</p>
      </header>

      <main className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 lg:gap-8 w-full max-w-4xl px-2"> {/* Responsive grid and padding */}
        {/* Inventory Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 border border-border/50 rounded-xl"> {/* Added border and rounded */}
          <CardHeader className="p-4"> {/* Adjusted padding */}
            <div className="flex items-center gap-3"> {/* Adjusted gap */}
              <Package className="w-8 h-8 text-primary" /> {/* Adjusted size */}
              <div>
                <CardTitle className="text-lg md:text-xl">المخزون</CardTitle> {/* Adjusted size */}
                <CardDescription className="text-xs md:text-sm">إدارة المنتجات والمخزون الخاص بك</CardDescription> {/* Adjusted size */}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4"> {/* Adjusted gap and padding */}
            <p className="text-sm text-muted-foreground">أضف منتجات جديدة باستخدام الباركود، تتبع الكميات والأسعار.</p>
            <Link href="/inventory" passHref>
              <Button size="sm" className="w-full btn-animated bg-primary hover:bg-primary/90 text-xs md:text-sm"> {/* Adjusted size and text */}
                إدارة المخزون
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Sales Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 border border-border/50 rounded-xl">
           <CardHeader className="p-4">
             <div className="flex items-center gap-3">
               <ShoppingCart className="w-8 h-8 text-primary" />
               <div>
                 <CardTitle className="text-lg md:text-xl">المبيعات</CardTitle>
                 <CardDescription className="text-xs md:text-sm">إنشاء وإدارة فواتير المبيعات</CardDescription>
               </div>
             </div>
           </CardHeader>
           <CardContent className="flex flex-col gap-3 p-4">
             <p className="text-sm text-muted-foreground">عرض المنتجات المتاحة، إنشاء فواتير، ومشاركتها أو طباعتها.</p>
             <Link href="/sales" passHref>
               <Button size="sm" className="w-full btn-animated bg-primary hover:bg-primary/90 text-xs md:text-sm">
                 إدارة المبيعات
               </Button>
             </Link>
           </CardContent>
        </Card>

        {/* Debts Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 border border-border/50 rounded-xl">
           <CardHeader className="p-4">
             <div className="flex items-center gap-3">
               <CreditCard className="w-8 h-8 text-primary" />
               <div>
                 <CardTitle className="text-lg md:text-xl">الديون</CardTitle>
                 <CardDescription className="text-xs md:text-sm">إدارة ديون العملاء والموردين</CardDescription>
               </div>
             </div>
           </CardHeader>
           <CardContent className="flex flex-col gap-3 p-4">
             <p className="text-sm text-muted-foreground">تتبع الديون المستحقة عليك ولصالحك، وإدارة المدينين.</p>
             <Link href="/debts" passHref>
               <Button size="sm" className="w-full btn-animated bg-primary hover:bg-primary/90 text-xs md:text-sm">
                 إدارة الديون
               </Button>
             </Link>
           </CardContent>
        </Card>

        {/* Reports Card */}
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 border border-border/50 rounded-xl">
           <CardHeader className="p-4">
             <div className="flex items-center gap-3">
               <FileText className="w-8 h-8 text-primary" />
               <div>
                 <CardTitle className="text-lg md:text-xl">التقارير</CardTitle>
                 <CardDescription className="text-xs md:text-sm">عرض التقارير الشاملة</CardDescription>
               </div>
             </div>
           </CardHeader>
           <CardContent className="flex flex-col gap-3 p-4">
             <p className="text-sm text-muted-foreground">احصل على نظرة شاملة على أداء عملك من خلال التقارير المفصلة.</p>
             <Link href="/reports" passHref>
               <Button size="sm" className="w-full btn-animated bg-primary hover:bg-primary/90 text-xs md:text-sm">
                 عرض التقارير
               </Button>
             </Link>
           </CardContent>
        </Card>
      </main>
    </div>
  );
}
