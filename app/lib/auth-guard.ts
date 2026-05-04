// クライアントサイドでの誤用を防止（セッション検証はサーバーサイドでのみ安全）
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthClient, createAuthGuard } from "@taimei-code/auth-client";

const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3100";
const serviceKey = process.env.AUTH_SERVICE_KEY;

const client = createAuthClient({
  baseUrl: `${authServiceUrl}/rpc`,
  serviceKey,
});

const guard = createAuthGuard({
  client,
  cache,
  redirect,
  getSessionToken: async () => {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("better-auth.session_token")?.value ??
      cookieStore.get("__Secure-better-auth.session_token")?.value;
    return token;
  },
});

// cache() で同一リクエスト内のRPC呼び出しを1回に抑制（layout/page で複数回呼んでも効率的）
export const verifySession = guard.verifySession;

// verifySession と異なりリダイレクトしない（ルートページ等で認証状態に応じた分岐が必要な場合用）
export const getSession = guard.getSession;

export type Session = Awaited<ReturnType<typeof getSession>>;
export type VerifiedSession = Exclude<Session, null>;
