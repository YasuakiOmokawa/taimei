import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { user } from "@/db/drizzle/schema";
import { eq, sql } from "drizzle-orm";

export class UserService extends Effect.Service<UserService>()(
  "services/UserService",
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
              new UserServiceError({ message: `existsByEmail failed: ${e}` }),
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
              new UserServiceError({ message: `findByEmail failed: ${e}` }),
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
              new UserServiceError({ message: `findById failed: ${e}` }),
          }),

        update: (id: string, data: { name?: string; image?: string | null }) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .update(user)
                  .set(data)
                  .where(eq(user.id, id))
                  .returning()
                  .then((res) => res.at(0)),
              catch: (e) =>
                new UserServiceError({ message: `update failed: ${e}` }),
            });
            if (!result) {
              return yield* new UserNotFound({ id });
            }
            return result;
          }),

        delete: (id: string) =>
          Effect.gen(function* () {
            const existing = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .select()
                  .from(user)
                  .where(eq(user.id, id))
                  .then((res) => res.at(0)),
              catch: (e) =>
                new UserServiceError({ message: `delete findById failed: ${e}` }),
            });
            if (!existing) {
              return yield* new UserNotFound({ id });
            }
            yield* Effect.tryPromise({
              try: () =>
                pgdrizzle.delete(user).where(eq(user.id, id)).returning(),
              catch: (e) =>
                new UserServiceError({ message: `delete failed: ${e}` }),
            });
          }),

        clearImage: (id: string) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .update(user)
                  .set({ image: null })
                  .where(eq(user.id, id))
                  .returning()
                  .then((res) => res.at(0)),
              catch: (e) =>
                new UserServiceError({ message: `clearImage failed: ${e}` }),
            });
            if (!result) {
              return yield* new UserNotFound({ id });
            }
            return result;
          }),
      } as const;
    }),
  }
) {}

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  id: string;
}> {}

export class UserServiceError extends Data.TaggedError("UserServiceError")<{
  message: string;
}> {}
