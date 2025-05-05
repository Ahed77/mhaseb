
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { auth } from '@/lib/firebase/config'; // Import Firebase auth
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation'; // Import useRouter for redirection
import { Loader2 } from 'lucide-react'; // Import Loader icon

// Google Icon SVG Component
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.21 0 5.89 1.11 7.89 2.92l-2.35 2.21c-.96-.91-2.35-1.6-3.54-1.6-2.8 0-5.09 1.89-5.93 4.42h-4.76v-3.56C11.27 11.83 17.09 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.14 25.1c0-1.69-.15-3.3-.41-4.86H24v9.09h12.2c-.54 2.95-2.1 5.45-4.64 7.17v5.72h7.35C43.4 38.07 46.14 32.07 46.14 25.1z"></path>
    <path fill="#FBBC05" d="M10.18 28.18c-.3-.91-.48-1.88-.48-2.88s.18-1.97.48-2.88v-5.72H2.83C1.01 20.07 0 23.42 0 27.3c0 3.88 1.01 7.23 2.83 10.12l7.35-5.72z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.35-5.72c-2.16 1.45-4.91 2.3-8.54 2.3-6.57 0-12.15-4.42-14.18-10.36H2.83v5.99C6.77 43.31 14.6 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  const handleSocialLogin = async () => {
    setIsLoadingGoogle(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // This gives you a Google Access Token. You can use it to access the Google API.
      // const credential = GoogleAuthProvider.credentialFromResult(result);
      // const token = credential?.accessToken;
      // The signed-in user info.
      const user = result.user;
      console.log("Google Sign-in successful:", user);
      toast({
        title: "نجاح",
        description: `تم تسجيل الدخول بنجاح كـ ${user.displayName || user.email}.`,
      });
      router.push('/'); // Redirect to home page after successful login
    } catch (error: any) {
      console.error("Google Sign-in error:", error);
      // Handle specific errors
      let errorMessage = "حدث خطأ أثناء تسجيل الدخول بحساب جوجل.";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "تم إلغاء تسجيل الدخول بواسطة المستخدم.";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "يوجد حساب بنفس البريد الإلكتروني ولكن ببيانات دخول مختلفة.";
      }
      toast({
        title: "خطأ في تسجيل الدخول",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
        setIsLoadingGoogle(false);
    }
  };

   const handleFormSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       setIsLoadingForm(true);
       try {
           const userCredential = await signInWithEmailAndPassword(auth, email, password);
           const user = userCredential.user;
            console.log("Email/Password Sign-in successful:", user);
           toast({
               title: "نجاح",
               description: `تم تسجيل الدخول بنجاح كـ ${user.email}.`,
            });
           router.push('/'); // Redirect to home page
       } catch (error: any) {
           console.error("Email/Password Sign-in error:", error);
            let errorMessage = "فشل تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.";
           if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
               errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
           } else if (error.code === 'auth/invalid-email') {
               errorMessage = "البريد الإلكتروني غير صالح.";
           } else if (error.code === 'auth/too-many-requests') {
               errorMessage = "تم حظر الحساب مؤقتًا بسبب كثرة محاولات الدخول الفاشلة. حاول مرة أخرى لاحقًا.";
           }
           toast({
               title: "خطأ في تسجيل الدخول",
               description: errorMessage,
               variant: "destructive",
           });
       } finally {
           setIsLoadingForm(false);
       }
   };


  return (
    <div className="flex justify-center items-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold text-primary">تسجيل الدخول</CardTitle>
           <CardDescription>أدخل بيانات حسابك للمتابعة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFormSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="أدخل بريدك الإلكتروني"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoadingForm || isLoadingGoogle} // Disable while loading
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                    id="password"
                    type="password"
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoadingForm || isLoadingGoogle} // Disable while loading
                />
              </div>
              {/* Forgot password link - Implement functionality later if needed */}
              {/* <Link href="/forgot-password" className="text-sm text-primary hover:underline text-right">
                نسيت كلمة المرور؟
              </Link> */}
               <Button type="submit" className="w-full btn-animated bg-primary hover:bg-primary/90" disabled={isLoadingForm || isLoadingGoogle}>
                 {isLoadingForm && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                 {isLoadingForm ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
               </Button>
            </div>
          </form>
        </CardContent>
         <CardFooter className="flex flex-col gap-4 pt-4 border-t px-6 pb-6">
           <div className="relative w-full">
             <Separator className="absolute top-1/2 left-0 w-full -translate-y-1/2" />
             <span className="relative bg-background px-2 text-xs uppercase text-muted-foreground z-10 block text-center">
               أو
             </span>
           </div>

           <Button variant="outline" className="w-full btn-animated" onClick={handleSocialLogin} disabled={isLoadingForm || isLoadingGoogle}>
               {isLoadingGoogle && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
               حساب جوجل
               {!isLoadingGoogle && <GoogleIcon />}
           </Button>

           <p className="text-sm text-muted-foreground text-center mt-2">
             ليس لديك حساب؟{' '}
             <Link href="/signup" className="text-primary hover:underline font-medium">
               إنشاء حساب
             </Link>
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
