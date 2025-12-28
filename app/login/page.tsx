import { LoginForm } from "@/components/login-form";
import { LoginPageFlash } from "@/app/ui/login-page-flash";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense>
          <LoginPageFlash />
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
