import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Effect } from "effect";
import { userProfile } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";
import { IdGenerator } from "./id-generator-service";
import {
  UserProfileNotFound,
  UserProfileServiceError,
} from "./user-profile-errors";

export class UserProfileService extends Effect.Service<UserProfileService>()(
  "services/UserProfileService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;
      const idGenerator = yield* IdGenerator;

      return {
        findByUserId: (userId: string) =>
          Effect.gen(function* () {
            const profile = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .select()
                  .from(userProfile)
                  .where(eq(userProfile.userId, userId))
                  .then((res) => res.at(0)),
              catch: (e) =>
                new UserProfileServiceError({
                  message: `findByUserId failed: ${e}`,
                }),
            });
            if (!profile) {
              return yield* new UserProfileNotFound({ userId });
            }
            return profile;
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
                new UserProfileServiceError({
                  message: `upsert failed: ${e}`,
                }),
            });
          }),
      } as const;
    }),
  }
) {}
