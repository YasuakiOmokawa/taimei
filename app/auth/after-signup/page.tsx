import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/auth-guard";

// Better Auth のサインアップ後着地点。taimei-auth の SignUp から callbackURL=https://app.taimei-code.com/auth/after-signup に飛んでくる。
//
// 分岐:
// (1) 未認証 → taimei-auth の error 画面に誘導
// (2) createdAt が 5 分以上前 → 既存ユーザーが /auth/signup に来た = 二重サインアップ → taimei-auth の error 画面 (signup_already_completed)
// (3) 新規ユーザー → /setting/profile?welcome=1 で profile 補完を促す (welcome 表示は profile 画面側に統合)
//
// 5 分の根拠: Better Auth Magic Link の expiresIn=300 と一致 — Magic Link クリック後 5 分以内なら新規。
// 5 分以上前は既にセッション確立済 (= 既存ユーザー) と判断する。
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.taimei-code.com";
const NEW_USER_WINDOW_MS = 5 * 60 * 1000;

export default async function AfterSignUpPage() {
  const session = await getSession();
  if (!session) {
    redirect(`${AUTH_URL}/auth/error?reason=signin_failed`);
  }

  const createdAt = new Date(session.user.createdAt);
  const isWithinNewUserWindow =
    Date.now() - createdAt.getTime() < NEW_USER_WINDOW_MS;

  if (!isWithinNewUserWindow) {
    redirect(`${AUTH_URL}/auth/error?reason=signup_already_completed`);
  }

  redirect("/setting/profile?welcome=1");
}
