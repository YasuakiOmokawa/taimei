import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { user } from "@/db/drizzle/schema";
import { eq, sql } from "drizzle-orm";

export class UserRepository extends Effect.Service<UserRepository>()(
  "services/UserRepository",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        existsByEmail: (email: string) =>
          Effect.tryPromise({
            try: async () => {
              const result = await pgdrizzle
                .select({ count: sql<number>`count(*)` })
                .from(user)
                .where(eq(user.email, email));
              return Number(result[0].count) > 0;
            },
            catch: (e) =>
              new UserRepositoryError({ message: `UserRepositoryError: ${e}` }),
          }),

        findByEmail: (email: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(user)
                .where(eq(user.email, email))
                .then((res) => res.at(0)),
            catch: (e) =>
              new UserRepositoryError({ message: `UserRepositoryError: ${e}` }),
          }),

        findById: (id: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(user)
                .where(eq(user.id, id))
                .then((res) => res.at(0)),
            catch: (e) =>
              new UserRepositoryError({ message: `UserRepositoryError: ${e}` }),
          }),

        update: (id: string, data: { name?: string; image?: string | null }) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .update(user)
                .set(data)
                .where(eq(user.id, id))
                .returning()
                .then((res) => res.at(0)),
            catch: (e) =>
              new UserRepositoryError({
                message: `Failed to update user: ${e}`,
              }),
          }),

        delete: (id: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle.delete(user).where(eq(user.id, id)).returning(),
            catch: (e) =>
              new UserRepositoryError({
                message: `Failed to delete user: ${e}`,
              }),
          }),
      } as const;
    }),
  }
) {}

export class UserRepositoryError extends Data.TaggedError(
  "UserRepositoryError"
)<{
  message: string;
}> {}
