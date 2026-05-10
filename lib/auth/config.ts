// auth-client SDK の接続設定の単一情報源。process.env はこのモジュールでのみ直読みする。
// 経緯は ADR-005 参照 (plans/taimei/ADR-005-auth-service-pattern-unification.md)。
import "server-only";

// fallback 値はローカル開発用 (compose 経由で taimei-auth が port 3100 で起動する前提)。
// 本番では Vercel env で必ず注入される運用になっており、未注入時は CI / Vercel 側の env 検証で
// 弾かれるため fail-fast せず fallback を許容する。
// FIXME(ADR-005 Phase 2): zod schema で起動時検証を入れ、prod での silent fallback を構造的に防ぐ。
//   serviceKey が undefined のまま SDK に渡る現状の挙動も、Phase 2 で必須化判定とともに見直す。
const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3100";
const serviceKey = process.env.AUTH_SERVICE_KEY;

export const authClientConfig = {
  baseUrl: `${authServiceUrl}/rpc`,
  serviceKey,
} as const;
