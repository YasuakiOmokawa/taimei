import { Data, Effect } from "effect";
import { UserProfileRepository } from "./user-profile-repository";

export class UserProfileNotFound extends Data.TaggedError(
  "UserProfileNotFound"
)<{
  userId: string;
}> {}

export class UserProfileService extends Effect.Service<UserProfileService>()(
  "services/UserProfileService",
  {
    effect: Effect.gen(function* () {
      const repository = yield* UserProfileRepository;

      return {
        findByUserId: (userId: string) =>
          Effect.gen(function* () {
            const profile = yield* repository.findByUserId(userId);
            if (!profile) {
              return yield* new UserProfileNotFound({ userId });
            }
            return profile;
          }),

        upsert: (userId: string, bio: string) => repository.upsert(userId, bio),
      } as const;
    }),
  }
) {}
