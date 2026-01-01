import { redirect } from "next/navigation"
import { getSession } from "@/app/lib/auth-guard"
import { AuthForm } from "@/components/auth-form"
import { AuthMessageHandler } from "@/app/ui/auth-message-handler"
import { Suspense } from "react"

/**
 * 統合認証ページ（Magic Link / GitHub OAuth）
 * Better Auth の設計思想に沿い、ログイン/新規登録を分けない
 */
export default async function AuthPage() {
  const session = await getSession()
  // 認証済みユーザーは認証画面不要のため dashboard へ
  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense>
          <AuthMessageHandler />
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}
