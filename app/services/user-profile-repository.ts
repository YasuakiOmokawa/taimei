import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect, Layer } from "effect";
import { userProfile } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";
import { IdGenerator } from "./id-generator-service";

const makeUserProfileRepository = Effect.all([
  PgDrizzle.PgDrizzle,
  IdGenerator,
]).pipe(
  Effect.andThen(([pgdrizzle, idGenerator]) => ({
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
  }))
);

export class UserProfileRepository extends Effect.Tag(
  "services/UserProfileRepository"
)<UserProfileRepository, Effect.Effect.Success<typeof makeUserProfileRepository>>() {
  static Live = Layer.effect(this, makeUserProfileRepository);
}

export class UserProfileRepositoryError extends Data.TaggedError(
  "UserProfileRepositoryError"
)<{
  message: string;
}> {}
