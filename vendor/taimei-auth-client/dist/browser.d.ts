/**
 * ブラウザ用 Better Auth クライアント
 *
 * プロダクト側で baseURL を auth-service に向けるだけで利用可能。
 * signIn, signOut, useSession 等は Better Auth のネイティブ API をそのまま使用。
 *
 * 使用例:
 *   import { createBrowserAuthClient } from "@taimei/auth-client/browser";
 *   const authClient = createBrowserAuthClient({ baseURL: "https://auth.taimei-code.com" });
 *   const { signIn, signOut, useSession } = authClient;
 */
export type BrowserAuthClientOptions = {
    baseURL: string;
};
export declare function createBrowserAuthClient(options: BrowserAuthClientOptions): {
    baseURL: string;
};
//# sourceMappingURL=browser.d.ts.map