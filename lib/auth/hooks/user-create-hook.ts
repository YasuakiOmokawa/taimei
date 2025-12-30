import { GenericEndpointContext } from "@better-auth/core";
import { getOAuthState as getOAuthStateFn } from "better-auth/api";
import {
  AuthErrorCode,
  AUTH_ERROR_MESSAGES,
} from "@/lib/auth/messages/auth-messages";

type OAuthState = Awaited<ReturnType<typeof getOAuthStateFn>>;

/**
 * ログイン画面からの OAuth で未登録ユーザーが来た場合、
 * 自動登録させず新規登録画面にリダイレクトする。
 * ログインフロー経由での自動ユーザー作成を防ぎ、ユーザーに明示的な登録意思確認を取る。
 */
export async function handleUserCreateBefore<T>(
  user: T,
  ctx: GenericEndpointContext | undefined,
  getOAuthState: () => Promise<OAuthState>
): Promise<{ data: T }> {
  const state = await getOAuthState();

  if (state?.mode === "login") {
    if (!ctx) {
      throw new Error(
        "Cannot create user in login mode: context not available"
      );
    }

    // maxAge: 1 で即時削除。リダイレクト先の FlashToaster が読み取り後に破棄される
    ctx.setCookie(
      "flash",
      JSON.stringify({
        type: "error",
        message: AUTH_ERROR_MESSAGES[AuthErrorCode.LOGIN_UNREGISTERED],
      }),
      { maxAge: 1 }
    );

    throw ctx.redirect("/signup");
  }

  return { data: user };
}
