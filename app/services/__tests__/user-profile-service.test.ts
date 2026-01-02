import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { UserProfileService, UserProfileNotFound } from "../user-profile-service";
import {
  withRollback,
  useFactoryReset,
  getFactory,
  runServiceWithTx,
} from "./db/test-helpers";

describe("UserProfileService", () => {
  useFactoryReset();

  describe("findByUserId", () => {
    it("正常系: プロフィールが存在する場合、プロフィールを返す", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const user = await f.user.create();
        await f.userProfile.create({ userId: user.id, bio: "テスト自己紹介" });

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserProfileService;
            return yield* service.findByUserId(user.id);
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right.userId).toBe(user.id);
          expect(result.right.bio).toBe("テスト自己紹介");
        }
      });
    });

    it("異常系: プロフィールが存在しない場合、UserProfileNotFound を返す", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const user = await f.user.create();

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserProfileService;
            return yield* service.findByUserId(user.id);
          })
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(UserProfileNotFound);
          expect(result.left._tag).toBe("UserProfileNotFound");
        }
      });
    });
  });

  describe("upsert", () => {
    it("正常系: 新規プロフィールを作成できる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const user = await f.user.create();

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserProfileService;
            return yield* service.upsert(user.id, "新しい自己紹介");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right.userId).toBe(user.id);
          expect(result.right.bio).toBe("新しい自己紹介");
        }
      });
    });

    it("正常系: 既存プロフィールを更新できる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const user = await f.user.create();
        await f.userProfile.create({ userId: user.id, bio: "古い自己紹介" });

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserProfileService;
            return yield* service.upsert(user.id, "更新後の自己紹介");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right.userId).toBe(user.id);
          expect(result.right.bio).toBe("更新後の自己紹介");
        }
      });
    });
  });
});
