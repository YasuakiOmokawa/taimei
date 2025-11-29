import { describe, it, expect } from "vitest";
import { Effect, Either, Layer } from "effect";
import { UserService, UserNotFound } from "../user-service";
import { UserRepository } from "../user-repository";
import { runWithLayer } from "./test-helpers";

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const createMockRepository = (initialUsers: User[] = []) => {
  const users = [...initialUsers];

  return {
    existsByEmail: (email: string) =>
      Effect.succeed(users.some((u) => u.email === email)),

    findByEmail: (email: string) =>
      Effect.succeed(users.find((u) => u.email === email)),

    findById: (id: string) => Effect.succeed(users.find((u) => u.id === id)),

    update: (id: string, data: { name?: string; image?: string | null }) =>
      Effect.succeed(
        (() => {
          const index = users.findIndex((u) => u.id === id);
          if (index === -1) return undefined;
          users[index] = {
            ...users[index],
            ...data,
            updatedAt: new Date(),
          };
          return users[index];
        })()
      ),

    delete: (id: string) =>
      Effect.succeed(
        (() => {
          const index = users.findIndex((u) => u.id === id);
          if (index === -1) return [];
          return users.splice(index, 1);
        })()
      ),
  };
};

const createTestLayer = (initialUsers: User[] = []) =>
  UserService.Live.pipe(
    Layer.provide(Layer.succeed(UserRepository, createMockRepository(initialUsers)))
  );

const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: "test-user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: "https://example.com/avatar.png",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

describe("UserService", () => {
  describe("update", () => {
    it("正常系: ユーザー名を更新できる", async () => {
      const existingUser = createTestUser();

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.update("test-user-1", { name: "Updated Name" });
        }),
        createTestLayer([existingUser])
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.name).toBe("Updated Name");
      }
    });

    it("正常系: ユーザー画像を更新できる", async () => {
      const existingUser = createTestUser();

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.update("test-user-1", {
            image: "https://example.com/new-avatar.png",
          });
        }),
        createTestLayer([existingUser])
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.image).toBe("https://example.com/new-avatar.png");
      }
    });

    it("異常系: 存在しないユーザーを更新しようとするとエラー", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.update("non-existent-id", { name: "New Name" });
        }),
        createTestLayer()
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(UserNotFound);
        expect(result.left._tag).toBe("UserNotFound");
      }
    });
  });

  describe("delete", () => {
    it("正常系: ユーザーを削除できる", async () => {
      const existingUser = createTestUser();

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.delete("test-user-1");
        }),
        createTestLayer([existingUser])
      );

      expect(Either.isRight(result)).toBe(true);
    });

    it("異常系: 存在しないユーザーを削除しようとするとエラー", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.delete("non-existent-id");
        }),
        createTestLayer()
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(UserNotFound);
        expect(result.left._tag).toBe("UserNotFound");
      }
    });
  });

  describe("clearImage", () => {
    it("正常系: ユーザー画像をクリアできる", async () => {
      const existingUser = createTestUser();

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.clearImage("test-user-1");
        }),
        createTestLayer([existingUser])
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.image).toBeNull();
      }
    });

    it("異常系: 存在しないユーザーの画像をクリアしようとするとエラー", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.clearImage("non-existent-id");
        }),
        createTestLayer()
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(UserNotFound);
        expect(result.left._tag).toBe("UserNotFound");
      }
    });
  });

  describe("existsByEmail", () => {
    it("正常系: 存在するメールアドレスで true を返す", async () => {
      const existingUser = createTestUser();

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.existsByEmail("test@example.com");
        }),
        createTestLayer([existingUser])
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBe(true);
      }
    });

    it("正常系: 存在しないメールアドレスで false を返す", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.existsByEmail("nonexistent@example.com");
        }),
        createTestLayer()
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBe(false);
      }
    });
  });
});
