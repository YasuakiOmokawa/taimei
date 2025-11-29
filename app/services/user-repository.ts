import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect, Layer } from "effect";
import { user } from "@/db/drizzle/schema";
import { eq, sql } from "drizzle-orm";

const makeUserRepository = Effect.andThen(PgDrizzle.PgDrizzle, (pgdrizzle) => ({
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
}));

export class UserRepository extends Effect.Tag("services/UserRepository")<
  UserRepository,
  Effect.Effect.Success<typeof makeUserRepository>
>() {
  static Live = Layer.effect(this, makeUserRepository);
}

export class UserRepositoryError extends Data.TaggedError(
  "UserRepositoryError"
)<{
  message: string;
}> {}
