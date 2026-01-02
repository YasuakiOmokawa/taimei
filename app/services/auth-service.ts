import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { account } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";
import { MagicLinkError, SessionError, SignOutError } from "./auth-errors";

export class AuthServiceError extends Data.TaggedError("AuthServiceError")<{
  message: string;
}> {}

export class AuthService extends Effect.Service<AuthService>()(
  "services/AuthService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

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

        findAccountByUserId: (userId: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(account)
                .where(eq(account.userId, userId))
                .then((res) => res.at(0)),
            catch: (e) =>
              new AuthServiceError({
                message: `findAccountByUserId failed: ${e}`,
              }),
          }),
      } as const;
    }),
  }
) {}
