/**
 * Next.js 用セッション検証ヘルパー
 *
 * 使用例:
 *   import { createAuthGuard } from "@taimei/auth-client/guard";
 *   const { verifySession, getSession } = createAuthGuard({ ... });
 *
 * Next.js の cache() と redirect() を外部注入することで、
 * このモジュール自体は Next.js に直接依存しない。
 */
import type { createAuthClient } from "./server";
type AuthClient = ReturnType<typeof createAuthClient>;
type GuardOptions = {
    client: AuthClient;
    cache: <T extends (...args: any[]) => any>(fn: T) => T;
    redirect: (url: string) => never;
    getSessionToken: () => Promise<string | undefined>;
};
type SessionData = {
    user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string;
        createdAt: string;
        updatedAt: string;
    };
    session: {
        id: string;
        token: string;
        expiresAt: string;
        userId: string;
    };
};
export declare function createAuthGuard(options: GuardOptions): {
    verifySession: (opts?: {
        returnTo?: string;
    }) => Promise<SessionData>;
    getSession: () => Promise<SessionData | null>;
};
export {};
//# sourceMappingURL=guard.d.ts.map