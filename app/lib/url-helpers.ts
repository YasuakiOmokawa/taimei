import "server-only";
import { headers } from "next/headers";

// Better Auth は relative path を auth-service の baseURL 相対で解決するため、
// taimei オリジンへ戻すには絶対 URL を組み立てる必要がある。
// プロキシ環境（Vercel 等）を想定して x-forwarded-proto も参照する。
export async function buildAbsoluteCallbackURL(
  redirectPath: string,
): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}${redirectPath}`;
}
