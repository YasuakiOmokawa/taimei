import { redirect } from "next/navigation"
import { getSession } from "@/app/lib/auth-guard"
import { SignUpForm } from "@/components/signup-form"
import { AuthMessageHandler } from "@/app/ui/auth-message-handler"
import { Suspense } from "react"

export default async function SignUpPage() {
  const session = await getSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense>
          <AuthMessageHandler />
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}
