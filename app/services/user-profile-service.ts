import { Data, Effect, Layer } from "effect";
import { UserProfileRepository } from "./user-profile-repository";

export class UserProfileNotFound extends Data.TaggedError(
  "UserProfileNotFound"
)<{
  userId: string;
}> {}

const makeUserProfileService = Effect.gen(function* () {
  const repository = yield* UserProfileRepository;

  const findByUserId = (userId: string) =>
    Effect.gen(function* () {
      const profile = yield* repository.findByUserId(userId);
      if (!profile) {
        return yield* new UserProfileNotFound({ userId });
      }
      return profile;
    });

  const upsert = (userId: string, bio: string) => repository.upsert(userId, bio);

  return { findByUserId, upsert };
});

export class UserProfileService extends Effect.Tag("services/UserProfileService")<
  UserProfileService,
  Effect.Effect.Success<typeof makeUserProfileService>
>() {
  static Live = Layer.effect(this, makeUserProfileService);
}
