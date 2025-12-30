import { redirect } from "next/navigation"
import { getSession } from "@/app/lib/auth-guard"
import { LoginForm } from "@/components/login-form"
import { LoginPageFlash } from "@/app/ui/login-page-flash"
import { Suspense } from "react"

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect("/dashboard")
  }

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
