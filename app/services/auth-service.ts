import { Effect } from "effect";
import { Email } from "@/app/domain/email";
import { authClient } from "@/lib/auth/client";
import {
  AuthServiceError,
  MagicLinkError,
  SessionError,
  SignOutError,
} from "./auth-errors";
import type { CookieReadError } from "./cookie-reader-errors";
import { CookieReader } from "./cookie-reader-service";

export class AuthService extends Effect.Service<AuthService>()(
  "services/AuthService",
  {
    effect: Effect.gen(function* () {
      const { authService } = authClient;
      const cookieReader = yield* CookieReader;

      // CookieReadError を呼出側のエラー型 (SessionError / SignOutError 等) に wrap して
      // 消費側 (Server Action) のエラーハンドリングを増やさない。
      // toError の引数は CookieReadError として型付け、cause chain を呼出側で型安全に辿れるようにする。
      const readToken = <E>(toError: (cause: CookieReadError) => E) =>
        cookieReader.readSessionToken.pipe(
          Effect.catchTag("CookieReadError", (e) => Effect.fail(toError(e))),
        );

      return {
        getSession: () =>
          Effect.gen(function* () {
            const token = yield* readToken(
              (cause) => new SessionError({ cause }),
            );

            if (!token) return null;

            const result = yield* Effect.tryPromise({
              try: () => authService.verifySession({ sessionToken: token }),
              catch: (e) => new SessionError({ cause: e }),
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
          }),

        signOut: () =>
          Effect.gen(function* () {
            const token = yield* readToken(
              (cause) => new SignOutError({ cause }),
            );

            if (token) {
              yield* Effect.tryPromise({
                try: () => authService.signOut({ sessionToken: token }),
                catch: (e) => new SignOutError({ cause: e }),
              });
            }
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
