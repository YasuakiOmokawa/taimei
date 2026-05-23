import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/auth-guard";

// Better Auth のログイン後着地点。taimei-auth から callbackURL=https://app.taimei-code.com/auth/after-signin に飛んでくる。
//
// 分岐:
// (1) 未認証 (session なし) → taimei-auth の error 画面に誘導 (signin_failed)
// (2) 認証済み → /dashboard 直行
//
// account profile 補完誘導は taimei-auth /account に集約済 (ADR-008)。
// `||` (truthy fallback) で空文字も fallback 対象にする (ADR-008、nav-user.tsx と統一)。
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.taimei-code.com";

export default async function AfterSignInPage() {
  const session = await getSession();
  if (!session) {
    redirect(`${AUTH_URL}/auth/error?reason=signin_failed`);
  }

  redirect("/dashboard");
}
