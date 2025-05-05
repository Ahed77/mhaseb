
import type {Metadata} from 'next';
import {Geist} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'; // Import Sidebar components
import AppSidebar from '@/components/app-sidebar'; // Import the new AppSidebar component
import { TooltipProvider } from "@/components/ui/tooltip"; // Ensure TooltipProvider wraps the layout
import { AuthProvider } from '@/context/auth-context'; // Import AuthProvider
import { ThemeProvider } from "next-themes"; // Import ThemeProvider


const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Note: Geist Mono font loading removed as it wasn't being used directly in body className.
// If needed elsewhere, ensure it's imported and applied correctly.

export const metadata: Metadata = {
  title: 'Easy Inventory',
  description: 'Simple Accounting and Inventory App',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
     <html lang="ar" dir="rtl" suppressHydrationWarning> {/* Add suppressHydrationWarning */}
       <body className={`${geistSans.variable} antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider> {/* Wrap with AuthProvider */}
              <TooltipProvider delayDuration={0}> {/* Ensure TooltipProvider is high up */}
                <SidebarProvider>
                  <Sidebar>
                    {/* Render the AppSidebar component inside the main Sidebar */}
                    <AppSidebar />
                  </Sidebar>
                  <SidebarInset>
                    <div className="container mx-auto p-4 relative"> {/* Add relative positioning for trigger */}
                       {/* Position SidebarTrigger in the top-left (adjust as needed) */}
                       <div className="absolute top-4 left-4 z-20 md:hidden"> {/* Show only on mobile initially */}
                          <SidebarTrigger />
                       </div>
                       <div className="pt-12 md:pt-0"> {/* Add padding top on mobile to avoid overlap */}
                          {children}
                       </div>
                       <Toaster /> {/* Add Toaster component */}
                    </div>
                  </SidebarInset>
                </SidebarProvider>
              </TooltipProvider>
             </AuthProvider>
          </ThemeProvider>
       </body>
     </html>
  );
}
