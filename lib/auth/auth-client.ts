import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// Server Action から呼び出す場合も考慮して baseURL を設定
// NEXT_PUBLIC_APP_URL が設定されていない場合は相対パス（ブラウザ用）
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? undefined,
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
