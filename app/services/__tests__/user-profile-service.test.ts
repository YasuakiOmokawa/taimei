import { expect } from "@effect/vitest";
import { Effect, Either } from "effect";
import { describe } from "vitest";
import { UserProfileNotFound } from "../user-profile-errors";
import { UserProfileService } from "../user-profile-service";
import { dbEffect } from "./db/effect-test-helpers";

describe("UserProfileService", () => {
  describe("findByUserId", () => {
    dbEffect(
      "正常系: プロフィールが存在する場合、プロフィールを返す",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const user = yield* Effect.promise(() => f.user.create());
          yield* Effect.promise(() =>
            f.userProfile.create({ userId: user.id, bio: "テスト自己紹介" }),
          );

          const service = yield* UserProfileService;
          const profile = yield* service.findByUserId(user.id);

          expect(profile.userId).toBe(user.id);
          expect(profile.bio).toBe("テスト自己紹介");
        }),
    );

    dbEffect(
      "異常系: プロフィールが存在しない場合、UserProfileNotFound を返す",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const user = yield* Effect.promise(() => f.user.create());

          const service = yield* UserProfileService;
          const result = yield* Effect.either(service.findByUserId(user.id));

          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left).toBeInstanceOf(UserProfileNotFound);
            expect(result.left._tag).toBe("UserProfileNotFound");
          }
        }),
    );
  });

  describe("upsert", () => {
    dbEffect("正常系: 新規プロフィールを作成できる", ({ factory: f }) =>
      Effect.gen(function* () {
        const user = yield* Effect.promise(() => f.user.create());

        const service = yield* UserProfileService;
        const profile = yield* service.upsert(user.id, "新しい自己紹介");

        expect(profile.userId).toBe(user.id);
        expect(profile.bio).toBe("新しい自己紹介");
      }),
    );

    dbEffect("正常系: 既存プロフィールを更新できる", ({ factory: f }) =>
      Effect.gen(function* () {
        const user = yield* Effect.promise(() => f.user.create());
        yield* Effect.promise(() =>
          f.userProfile.create({ userId: user.id, bio: "古い自己紹介" }),
        );

        const service = yield* UserProfileService;
        const profile = yield* service.upsert(user.id, "更新後の自己紹介");

        expect(profile.userId).toBe(user.id);
        expect(profile.bio).toBe("更新後の自己紹介");
      }),
    );
  });
});
