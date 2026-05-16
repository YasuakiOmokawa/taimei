// `lib/auth/client.ts` 経由で Service Key interceptor 注入済の authClient を import するため、
// bundle に Service Key が漏れる経路を server-only ガードで完全に閉じる。
import "server-only";
import { createAuthGuard, getSessionToken } from "@taimei-code/auth-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authClient } from "@/lib/auth/client";

const guard = createAuthGuard({
  client: authClient,
  cache,
  getSessionToken: async () => {
    const cookieStore = await cookies();
    return getSessionToken((name) => cookieStore.get(name)?.value);
  },
});

// requireSession と異なりリダイレクトしない（ルートページ等で認証状態に応じた分岐が必要な場合用）。
// cache() で同一リクエスト内の RPC 呼び出しを 1 回に抑制 (layout/page で複数回呼んでも効率的)。
export const getSession = guard.getSession;

export type Session = Awaited<ReturnType<typeof getSession>>;
export type VerifiedSession = Exclude<Session, null>;

// SDK 0.5.0 で SDK 側 requireSession は廃止 (ADR-007)。redirect 制御フローと
// login path 規約 `/auth?callbackUrl=` を consumer 側に集約する。
export const requireSession = async ({
  returnTo,
}: {
  returnTo: string;
}): Promise<VerifiedSession> => {
  const session = await getSession();
  if (!session) redirect(`/auth?callbackUrl=${encodeURIComponent(returnTo)}`);
  return session;
};
