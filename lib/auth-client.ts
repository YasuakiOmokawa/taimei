import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// ブラウザからの認証リクエストは auth-service に直接アクセス
// CORS は auth-service の Hono middleware で処理
const authServiceUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;

export const authClient = createAuthClient({
  baseURL: authServiceUrl ?? undefined,
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
