import {
  createAuthClient,
  extractSessionTokenFromCookieHeader,
} from "@taimei-code/auth-client";
import { Effect } from "effect";
import { Email } from "@/app/domain/email";
import {
  AuthServiceError,
  MagicLinkError,
  SessionError,
  SignOutError,
} from "./auth-errors";

const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3100";
const serviceKey = process.env.AUTH_SERVICE_KEY;

export class AuthService extends Effect.Service<AuthService>()(
  "services/AuthService",
  {
    effect: Effect.gen(function* () {
      const { authService } = createAuthClient({
        baseUrl: `${authServiceUrl}/rpc`,
        serviceKey,
      });

      // next/headers は Server Component / Server Action 文脈外で import すると build error になるため、
      // tryPromise 内で動的 import する。ES module キャッシュが効くので 2 回目以降のオーバーヘッドはない。
      const readSessionToken = async (): Promise<string | undefined> => {
        const { headers: h } = await import("next/headers");
        const headersList = await h();
        return extractSessionTokenFromCookieHeader(
          headersList.get("cookie") || "",
        );
      };

      return {
        getSession: () =>
          Effect.tryPromise({
            try: async () => {
              const token = await readSessionToken();

              if (!token) return null;

              const result = await authService.verifySession({
                sessionToken: token,
              });

              if (!result.user || !result.session) return null;

              return {
                user: {
                  id: result.user.id,
                  name: result.user.name,
                  email: result.user.email,
                  emailVerified: result.user.emailVerified,
                  image: result.user.image ?? null,
                  createdAt: new Date(result.user.createdAt),
                  updatedAt: new Date(result.user.updatedAt),
                },
                session: {
                  id: result.session.id,
                  expiresAt: new Date(result.session.expiresAt),
                },
              };
            },
            catch: (e) => new SessionError({ cause: e }),
          }),

        signOut: () =>
          Effect.tryPromise({
            try: async () => {
              const token = await readSessionToken();

              if (token) {
                await authService.signOut({ sessionToken: token });
              }
            },
            catch: (e) => new SignOutError({ cause: e }),
          }),

        sendMagicLink: (email: Email, callbackURL: string) =>
          Effect.tryPromise({
            try: async () => {
              await authService.sendMagicLink({
                email: email as string,
                callbackUrl: callbackURL,
              });
            },
            catch: (e) => new MagicLinkError({ cause: e }),
          }),

        findAccountByUserId: (userId: string) =>
          Effect.tryPromise({
            try: async () => {
              const result = await authService.findAccountByUserId({
                userId,
              });
              if (!result.account) return undefined;

              return {
                id: result.account.id,
                accountId: result.account.accountId,
                providerId: result.account.providerId,
                userId: result.account.userId,
                accessToken: result.account.accessToken ?? null,
                refreshToken: result.account.refreshToken ?? null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
                scope: result.account.scope ?? null,
                password: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            },
            catch: (e) =>
              new AuthServiceError({
                message: `findAccountByUserId failed: ${e}`,
              }),
          }),
      } as const;
    }),
  },
) {}
