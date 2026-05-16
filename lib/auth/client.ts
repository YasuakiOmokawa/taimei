// taimei-auth SDK の単一 instance を提供する module-singleton。接続先の単一情報源を保証する。
// 経緯は ADR-005 / ADR-007 参照 (plans/taimei/ADR-005, ADR-007)。
//
// server-only ガードは config.ts に集約し、ここから import するだけで連鎖的に効く。
// 注意: config.ts の `import "server-only"` を消す、または `authClientConfig` を別経路で
// inline 再定義して `./config` 経由を回避すると、client.ts のガードも同時に消える依存関係。
import { createConnectTransport } from "@connectrpc/connect-node";
import {
  createAuthClient,
  createServiceKeyInterceptor,
} from "@taimei-code/auth-client";
import { authClientConfig } from "./config";

// Service Key 注入。dev / local 環境では env 未設定で undefined になる (config.ts FIXME 参照)。
const interceptors = authClientConfig.serviceKey
  ? [createServiceKeyInterceptor(authClientConfig.serviceKey)]
  : [];

// Vercel Node runtime 想定で httpVersion 1.1 を指定。Edge / Workers に乗せ替える際は
// @connectrpc/connect-web に差し替え、httpVersion を省略する (ADR-007 README §3)。
const transport = createConnectTransport({
  httpVersion: "1.1",
  baseUrl: authClientConfig.baseUrl,
  interceptors,
});

export const authClient = createAuthClient({ transport });
