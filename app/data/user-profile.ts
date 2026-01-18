import { Effect, Either } from "effect";
import { runService, UserProfileService } from "@/app/services";

export type UserProfileSelectionById = {
  bio: string;
};

export async function fetchUserProfile(
  userId: string
): Promise<UserProfileSelectionById | null> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* UserProfileService;
      return yield* service.findByUserId(userId);
    })
  );

  if (Either.isLeft(result)) {
    if (result.left._tag === "UserProfileNotFound") {
      return null;
    }
    throw new Error("failed to fetch UserProfile.", { cause: result.left });
  }

  return { bio: result.right.bio };
}
