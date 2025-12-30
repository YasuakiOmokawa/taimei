import { Effect } from "effect";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AuthRepository } from "./auth-repository";
import { MagicLinkError, SessionError, SignOutError } from "./auth-errors";

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

        findAccountByUserId: (userId: string) => repo.findAccountByUserId(userId),
      } as const;
    }),
  }
) {}
