import { describe } from "vitest";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { dbEffect } from "./db/effect-test-helpers";
import { user } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";

describe("Factory (drizzle-factory)", () => {
  dbEffect("Factory でユーザーを作成できる", ({ tx, factory: f }) =>
    Effect.gen(function* () {
      const created = yield* Effect.promise(() =>
        f.user.create({ name: "DB Test User" })
      );

      expect(created.id).toMatch(/^test-user-/);
      expect(created.name).toBe("DB Test User");

      const found = yield* Effect.promise(() =>
        tx
          .select()
          .from(user)
          .where(eq(user.id, created.id))
          .then((r: (typeof user.$inferSelect)[]) => r[0])
      );

      expect(found?.name).toBe("DB Test User");
    })
  );

  dbEffect("複数ユーザーを作成できる", ({ factory: f }) =>
    Effect.gen(function* () {
      const users = yield* Effect.promise(() => f.user.create(3));

      expect(users).toHaveLength(3);
      expect(users[0].id).toBe("test-user-1");
      expect(users[1].id).toBe("test-user-2");
      expect(users[2].id).toBe("test-user-3");
    })
  );

  dbEffect("traits で未認証ユーザーを作成できる", ({ factory: f }) =>
    Effect.gen(function* () {
      const unverified = yield* Effect.promise(() =>
        f.user.traits.unverified.create()
      );

      expect(unverified.emailVerified).toBe(false);
    })
  );

  dbEffect("UserProfile と User を関連付けて作成できる", ({ factory: f }) =>
    Effect.gen(function* () {
      const profile = yield* Effect.promise(() =>
        f.userProfile.create({ bio: "My bio" })
      );

      expect(profile.userId).toMatch(/^test-user-/);
      expect(profile.bio).toBe("My bio");
    })
  );

  dbEffect(
    "トランザクション分離: 前のテストのデータは存在しない",
    ({ factory: f }) =>
      Effect.gen(function* () {
        const created = yield* Effect.promise(() => f.user.create());

        // resetSequence + ロールバックにより、毎回 test-user-1 から開始
        expect(created.id).toBe("test-user-1");
      })
  );
});
