// auth-client SDK の接続設定の単一情報源。process.env はこのモジュールでのみ直読みする。
// 経緯は ADR-005 参照 (plans/taimei/ADR-005-auth-service-pattern-unification.md)。
import "server-only";

const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3100";
const serviceKey = process.env.AUTH_SERVICE_KEY;

export const authClientConfig = {
  baseUrl: `${authServiceUrl}/rpc`,
  serviceKey,
} as const;
