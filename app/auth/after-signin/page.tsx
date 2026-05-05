import { redirect } from "next/navigation";
import { Effect, Either } from "effect";

import { getSession } from "@/app/lib/auth-guard";
import { runService, UserProfileService } from "@/app/services";

// Better Auth のログイン後着地点。taimei-auth から callbackURL=https://app.taimei-code.com/auth/after-signin に飛んでくる。
//
// 分岐:
// (1) 未認証 (session なし) → taimei-auth の error 画面に誘導 (signin_failed)
// (2) profile が DB に存在しない (初回ログイン) → /setting/profile で補完誘導
// (3) profile 既存 → /dashboard
//
// (2) の判定: UserProfileService.findByUserId が UserProfileNotFound を返す or null/undefined を返した場合。
// Effect 結果を Either で受け取り、Left (NotFound) or Right が空なら未補完と判断。
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.taimei-code.com";

export default async function AfterSignInPage() {
  const session = await getSession();
  if (!session) {
    redirect(`${AUTH_URL}/auth/error?reason=signin_failed`);
  }

  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* UserProfileService;
      return yield* service.findByUserId(session.user.id);
    }),
  );

  if (Either.isLeft(result) || result.right == null) {
    redirect("/setting/profile");
  }

  redirect("/dashboard");
}
