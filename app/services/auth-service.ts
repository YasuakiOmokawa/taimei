import { Effect } from "effect";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isTestEnvironment } from "@/lib/email/client";
import { AuthRepository } from "./auth-repository";
import {
  MagicLinkError,
  SessionError,
  SessionInvalidateError,
  SignOutError,
} from "./auth-errors";

export class AuthService extends Effect.Service<AuthService>()(
  "services/AuthService",
  {
    effect: Effect.gen(function* () {
      const repo = yield* AuthRepository;

      return {
        getSession: () =>
          Effect.tryPromise({
            try: async () => {
              const h = await headers();
              return await auth.api.getSession({ headers: h });
            },
            catch: (e) => new SessionError({ cause: e }),
          }),

        signOut: () =>
          Effect.tryPromise({
            try: async () => {
              const h = await headers();
              await auth.api.signOut({ headers: h });
            },
            catch: (e) => new SignOutError({ cause: e }),
          }),

        sendMagicLink: (email: string, callbackURL: string) =>
          Effect.tryPromise({
            try: async () => {
              const h = await headers();
              await auth.api.signInMagicLink({
                body: { email, callbackURL },
                headers: h,
              });
            },
            catch: (e) => new MagicLinkError({ cause: e }),
          }),

        invalidateSession: (sessionId: string) =>
          Effect.gen(function* () {
            yield* repo.deleteSession(sessionId);

            // cookieCache が有効なため、DB 削除だけでは不十分
            yield* Effect.tryPromise({
              try: async () => {
                const cookieStore = await cookies();
                const prefix = isTestEnvironment() ? "" : "__Secure-";
                cookieStore.delete(`${prefix}better-auth.session_token`);
                cookieStore.delete(`${prefix}better-auth.session_data`);
              },
              catch: (e) => new SessionInvalidateError({ cause: e }),
            });
          }).pipe(
            Effect.catchAll((e) => Effect.fail(new SessionInvalidateError({ cause: e })))
          ),

        findAccountByUserId: (userId: string) => repo.findAccountByUserId(userId),
      } as const;
    }),
  }
) {}
