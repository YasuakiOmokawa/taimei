import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { session, account } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";

export class AuthRepository extends Effect.Service<AuthRepository>()(
  "services/AuthRepository",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        deleteSession: (sessionId: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle.delete(session).where(eq(session.id, sessionId)),
            catch: (e) =>
              new AuthRepositoryError({
                message: `Failed to delete session: ${e}`,
              }),
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
              new AuthRepositoryError({
                message: `Failed to find account: ${e}`,
              }),
          }),
      } as const;
    }),
  }
) {}

export class AuthRepositoryError extends Data.TaggedError(
  "AuthRepositoryError"
)<{
  message: string;
}> {}
