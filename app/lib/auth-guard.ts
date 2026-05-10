// クライアントサイドでの誤用を防止（セッション検証はサーバーサイドでのみ安全）
import "server-only";
import {
  createAuthGuard,
  getSessionTokenFromCookieStore,
} from "@taimei-code/auth-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authClient } from "@/lib/auth/client";

const guard = createAuthGuard({
  client: authClient,
  cache,
  redirect,
  getSessionToken: async () => {
    const cookieStore = await cookies();
    return getSessionTokenFromCookieStore(cookieStore);
  },
});

// cache() で同一リクエスト内のRPC呼び出しを1回に抑制（layout/page で複数回呼んでも効率的）
export const verifySession = guard.verifySession;

// verifySession と異なりリダイレクトしない（ルートページ等で認証状態に応じた分岐が必要な場合用）
export const getSession = guard.getSession;

export type Session = Awaited<ReturnType<typeof getSession>>;
export type VerifiedSession = Exclude<Session, null>;
