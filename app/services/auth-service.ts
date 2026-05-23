import { Effect } from "effect";
import { Email } from "@/app/domain/email";
import { AuthClient } from "./auth-client-service";
import { MagicLinkError, SessionError } from "./auth-errors";
import type { CookieReadError } from "./cookie-reader-errors";
import { CookieReader } from "./cookie-reader-service";

// signOut は taimei-auth /account の SignOutButton に集約済 (ADR-008)。
// findAccountByUserId は旧 /setting/account/page.tsx の caller が ADR-008 で消えたため同時に撤去。
export class AuthService extends Effect.Service<AuthService>()(
  "services/AuthService",
  {
    effect: Effect.gen(function* () {
      const { authService } = yield* AuthClient;
      const cookieReader = yield* CookieReader;

      // CookieReadError を呼出側のエラー型 (SessionError 等) に wrap して
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

            // VerifySessionResponse は oneof outcome に再設計済。
            // outcome === "ok" 以外 (error / 未設定) は全て null に集約し、consumer は
            // SDK の VerifyResult ではなく自前 SessionError でハンドリングする (Effect 層)。
            if (verifyResult.outcome.case !== "ok") return null;
            const okValue = verifyResult.outcome.value;
            const user = okValue.user;
            const session = okValue.session;
            if (!user || !session) return null;

            return {
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image ?? null,
                createdAt: new Date(user.createdAt),
                updatedAt: new Date(user.updatedAt),
              },
              session: {
                id: session.id,
                expiresAt: new Date(session.expiresAt),
              },
            };
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
      } as const;
    }),
  },
) {}
