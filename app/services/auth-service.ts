import { Effect } from "effect";
import { Email } from "@/app/domain/email";
import { AuthClient } from "./auth-client-service";
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
      const { authService } = yield* AuthClient;
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

            const verifyResult = yield* Effect.tryPromise({
              try: () => authService.verifySession({ sessionToken: token }),
              catch: (e) => new SessionError({ cause: e }),
            });

            if (!verifyResult.user || !verifyResult.session) return null;

            return {
              user: {
                id: verifyResult.user.id,
                name: verifyResult.user.name,
                email: verifyResult.user.email,
                emailVerified: verifyResult.user.emailVerified,
                image: verifyResult.user.image ?? null,
                createdAt: new Date(verifyResult.user.createdAt),
                updatedAt: new Date(verifyResult.user.updatedAt),
              },
              session: {
                id: verifyResult.session.id,
                expiresAt: new Date(verifyResult.session.expiresAt),
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

        sendMagicLink: (email: Email, callbackUrl: string) =>
          Effect.tryPromise({
            try: async () => {
              await authService.sendMagicLink({
                email: Email.asString(email),
                callbackUrl,
              });
            },
            catch: (e) => new MagicLinkError({ cause: e }),
          }),

        // FIXME(ADR-005 DA2): null / new Date() の padding は proto contract が optional 化されて
        //   いないため呼出側型を満たす目的の偽値。OAuth provider 連携拡張時に proto 側で optional
        //   化し、ここの padding を削除する。`createdAt: new Date()` は事実と異なるため、呼出側で
        //   この値を信用しないこと (account 作成日時としては使えない)。
        findAccountByUserId: (userId: string) =>
          Effect.tryPromise({
            try: async () => {
              const accountResult = await authService.findAccountByUserId({
                userId,
              });
              if (!accountResult.account) return undefined;

              return {
                id: accountResult.account.id,
                accountId: accountResult.account.accountId,
                providerId: accountResult.account.providerId,
                userId: accountResult.account.userId,
                accessToken: accountResult.account.accessToken ?? null,
                refreshToken: accountResult.account.refreshToken ?? null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
                scope: accountResult.account.scope ?? null,
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
