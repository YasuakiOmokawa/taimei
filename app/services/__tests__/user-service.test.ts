import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { UserService, UserNotFound } from "../user-service";
import {
  withRollback,
  getFactory,
  useFactoryReset,
  runServiceWithTx,
} from "./db/test-helpers";

describe("UserService", () => {
  useFactoryReset();

  describe("update", () => {
    it("正常系: ユーザー名を更新できる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const created = await f.user.create();

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.update(created.id, { name: "Updated Name" });
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right.name).toBe("Updated Name");
        }
      });
    });

    it("正常系: ユーザー画像を更新できる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const created = await f.user.create();

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.update(created.id, {
              image: "https://example.com/new-avatar.png",
            });
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right.image).toBe("https://example.com/new-avatar.png");
        }
      });
    });

    it("異常系: 存在しないユーザーを更新しようとするとエラー", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.update("non-existent-id", {
              name: "New Name",
            });
          })
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(UserNotFound);
        }
      });
    });
  });

  describe("delete", () => {
    it("正常系: ユーザーを削除できる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const created = await f.user.create();

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.delete(created.id);
          })
        );

        expect(Either.isRight(result)).toBe(true);
      });
    });

    it("異常系: 存在しないユーザーを削除しようとするとエラー", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.delete("non-existent-id");
          })
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(UserNotFound);
        }
      });
    });
  });

  describe("clearImage", () => {
    it("正常系: ユーザー画像をクリアできる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const created = await f.user.create({
          image: "https://example.com/avatar.png",
        });

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.clearImage(created.id);
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right.image).toBeNull();
        }
      });
    });

    it("異常系: 存在しないユーザーの画像をクリアしようとするとエラー", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.clearImage("non-existent-id");
          })
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(UserNotFound);
        }
      });
    });
  });

  describe("existsByEmail", () => {
    it("正常系: 存在するメールアドレスで true を返す", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        await f.user.create({ email: "test@example.com" });

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.existsByEmail("test@example.com");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toBe(true);
        }
      });
    });

    it("正常系: 存在しないメールアドレスで false を返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.existsByEmail("nonexistent@example.com");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toBe(false);
        }
      });
    });
  });

  describe("findByEmail", () => {
    it("正常系: メールアドレスでユーザーを検索できる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const created = await f.user.create({ email: "test@example.com" });

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.findByEmail("test@example.com");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right?.id).toBe(created.id);
          expect(result.right?.email).toBe("test@example.com");
        }
      });
    });

    it("正常系: 存在しないメールアドレスでundefinedを返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.findByEmail("nonexistent@example.com");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toBeUndefined();
        }
      });
    });
  });

  describe("findById", () => {
    it("正常系: IDでユーザーを検索できる", async () => {
      await withRollback(async (tx) => {
        const f = getFactory(tx);
        const created = await f.user.create();

        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.findById(created.id);
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right?.id).toBe(created.id);
        }
      });
    });

    it("正常系: 存在しないIDでundefinedを返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* UserService;
            return yield* service.findById("non-existent-id");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toBeUndefined();
        }
      });
    });
  });
});
