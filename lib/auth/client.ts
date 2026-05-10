// taimei-auth SDK の単一 instance を提供する module-singleton。接続先の単一情報源を保証する。
// 経緯は ADR-005 参照 (plans/taimei/ADR-005-auth-service-pattern-unification.md)。
//
// server-only ガードは config.ts に集約し、ここから import するだけで連鎖的に効く。
// 注意: config.ts の `import "server-only"` を消す、または `authClientConfig` を別経路で
// inline 再定義して `./config` 経由を回避すると、client.ts のガードも同時に消える依存関係。
import { createAuthClient } from "@taimei-code/auth-client";
import { authClientConfig } from "./config";

export const authClient = createAuthClient(authClientConfig);
