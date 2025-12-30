import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { userProfile } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";
import { IdGenerator } from "./id-generator-service";

export class UserProfileRepository extends Effect.Service<UserProfileRepository>()(
  "services/UserProfileRepository",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;
      const idGenerator = yield* IdGenerator;

      return {
        findByUserId: (userId: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(userProfile)
                .where(eq(userProfile.userId, userId))
                .then((res) => res.at(0)),
            catch: (e) =>
              new UserProfileRepositoryError({
                message: `UserProfileRepositoryError: ${e}`,
              }),
          }),

        upsert: (userId: string, bio: string) =>
          Effect.gen(function* () {
            const id = yield* idGenerator.generate;
            const now = new Date();

            return yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .insert(userProfile)
                  .values({
                    id,
                    userId,
                    bio,
                    createdAt: now,
                    updatedAt: now,
                  })
                  .onConflictDoUpdate({
                    target: userProfile.userId,
                    set: { bio, updatedAt: now },
                  })
                  .returning()
                  .then((res) => res[0]),
              catch: (e) =>
                new UserProfileRepositoryError({
                  message: `UserProfileRepositoryError: ${e}`,
                }),
            });
          }),
      } as const;
    }),
  }
) {}

export class UserProfileRepositoryError extends Data.TaggedError(
  "UserProfileRepositoryError"
)<{
  message: string;
}> {}
