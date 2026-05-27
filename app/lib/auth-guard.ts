// `lib/auth/client.ts` 経由で Service Key interceptor 注入済の authClient を import するため、
// bundle に Service Key が漏れる経路を server-only ガードで完全に閉じる。
import "server-only";
import {
  createAuthGuard,
  getSessionToken,
  Result,
  type SessionData,
} from "@taimei-code/auth-client";
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

// SDK 1.0.0 で戻り値が VerifyResult discriminated union 化されたため、
// consumer 側で従来の `if (!session)` パターンを維持するための thin wrap を提供する。
// reason が REVISION_OUTDATED のときは login URL に hash を付けてユーザーに再ログイン要因を示す
// (現状は signin_failed への redirect で十分なので未実装、将来の UI 改善余地として残す)。
export const getSession = async (): Promise<SessionData | null> => {
  const result = await guard.getSession();
  if (!result.ok) return null;
  return result.data;
};

export type Session = Awaited<ReturnType<typeof getSession>>;
export type VerifiedSession = Exclude<Session, null>;

// SDK 0.5.0 で SDK 側 requireSession は廃止。redirect 制御フローと
// login path 規約 `/auth?callbackUrl=` を consumer 側に集約する。
// SDK 1.0.0 で getSession の戻り型が変わったため、上記 thin wrap 経由で従来の null チェックを維持。
export const requireSession = async ({
  returnTo,
}: {
  returnTo: string;
}): Promise<VerifiedSession> => {
  const session = await getSession();
  if (!session) redirect(`/auth?callbackUrl=${encodeURIComponent(returnTo)}`);
  return session;
};

// 事業所未選択 user の登録先 (taimei-auth web SPA 上)。設計詳細: docs/adr/0002-company-data-scoping.md (D5)。
// proxy.ts の AUTH_URL 解決と同型で NEXT_PUBLIC_AUTH_URL を base に絶対 URL を組む。
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.taimei-code.com";

export const buildCompanySignupUrl = (returnTo = "/dashboard") =>
  `${AUTH_URL}/auth/signup/company?returnTo=${encodeURIComponent(returnTo)}`;

// redirect + companyId 導出の SSOT。data 層の runScopedService と page 層の requireCompany が共有する。
// 未認証 (session null) と「認証済・事業所未選択」で redirect 先を分岐する。
// redirect() は Next の control-flow throw なので、Effect の外 (Next 境界) でしか実行できない。
export const resolveCompanyIdOrRedirect = async (returnTo = "/dashboard") => {
  const session = await getSession(); // react.cache 済 (page/data が同 cache を共有)
  if (!session) redirect(`/auth?callbackUrl=${encodeURIComponent(returnTo)}`);
  if (!session.companyId) redirect(buildCompanySignupUrl(returnTo));
  return { companyId: session.companyId, session };
};

// page レベル UX 用の thin wrapper。data fetch 前に layout で redirect して描画チラつきを防ぎ、
// nav 表示用に session も返す。security backstop ではない (それは runScopedService 自身)。
export const requireCompany = async ({ returnTo }: { returnTo: string }) => {
  const { companyId, session } = await resolveCompanyIdOrRedirect(returnTo);
  return { ...session, companyId };
};

// Result enum を consumer (page 等) でも参照可能にする re-export
export { Result };
