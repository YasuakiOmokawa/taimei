import { describe, it, expect } from "vitest";
import {
  useFactoryReset,
  getFactory,
  withRollback,
} from "./db/test-helpers";
import { user } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";

describe("Factory (drizzle-factory)", () => {
  useFactoryReset();

  it("Factory でユーザーを作成できる", async () => {
    await withRollback(async (tx) => {
      const f = getFactory(tx);
      const created = await f.user.create({ name: "DB Test User" });

      expect(created.id).toMatch(/^test-user-/);
      expect(created.name).toBe("DB Test User");

      const found = await tx
        .select()
        .from(user)
        .where(eq(user.id, created.id))
        .then((r: typeof user.$inferSelect[]) => r[0]);

      expect(found?.name).toBe("DB Test User");
    });
  });

  it("複数ユーザーを作成できる", async () => {
    await withRollback(async (tx) => {
      const f = getFactory(tx);
      const users = await f.user.create(3);

      expect(users).toHaveLength(3);
      expect(users[0].id).toBe("test-user-1");
      expect(users[1].id).toBe("test-user-2");
      expect(users[2].id).toBe("test-user-3");
    });
  });

  it("traits で未認証ユーザーを作成できる", async () => {
    await withRollback(async (tx) => {
      const f = getFactory(tx);
      const unverified = await f.user.traits.unverified.create();

      expect(unverified.emailVerified).toBe(false);
    });
  });

  it("UserProfile と User を関連付けて作成できる", async () => {
    await withRollback(async (tx) => {
      const f = getFactory(tx);
      const profile = await f.userProfile.create({ bio: "My bio" });

      expect(profile.userId).toMatch(/^test-user-/);
      expect(profile.bio).toBe("My bio");
    });
  });

  it("トランザクション分離: 前のテストのデータは存在しない", async () => {
    await withRollback(async (tx) => {
      const f = getFactory(tx);
      const created = await f.user.create();

      // シーケンスリセット + ロールバックにより、毎回 test-user-1 から開始
      expect(created.id).toBe("test-user-1");
    });
  });
});
