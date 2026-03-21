import { Effect } from "effect";
import {
  AuthServiceError,
  MagicLinkError,
  SessionError,
  SignOutError,
} from "./auth-errors";
import { Email } from "@/app/domain/email";
import { createAuthClient, mapConnectError } from "@taimei/auth-client";

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

      return {
        getSession: () =>
          Effect.tryPromise({
            try: async () => {
              // Cookie からセッショントークンを取得するのは呼び出し側の責務
              // ここでは headers() を直接使わず、auth-guard.ts 経由で呼ばれる
              const { headers: h } = await import("next/headers");
              const headersList = await h();
              const cookieHeader = headersList.get("cookie") || "";
              const tokenMatch = cookieHeader.match(
                /(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/
              );
              const token = tokenMatch?.[1];

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
                  token: result.session.token,
                  expiresAt: new Date(result.session.expiresAt),
                  userId: result.session.userId,
                },
              };
            },
            catch: (e) => new SessionError({ cause: e }),
          }),

        signOut: () =>
          Effect.tryPromise({
            try: async () => {
              const { headers: h } = await import("next/headers");
              const headersList = await h();
              const cookieHeader = headersList.get("cookie") || "";
              const tokenMatch = cookieHeader.match(
                /(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/
              );
              const token = tokenMatch?.[1];

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
  }
) {}
