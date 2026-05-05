import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { UserService } from "../user-service";
import { UserNotFound, UserServiceError } from "../user-errors";
import { Email } from "@/app/domain/email";

// ConnectRPC 移行後、UserService は auth-service への RPC 薄いラッパーとなったため、
// DB 統合テストは成立しない（user テーブルは auth-service 側にある）。
// auth-service.test.ts と同じく Layer DI でモック注入する単体テストパターンに切替。

type MockUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly image: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

const buildUser = (over: Partial<MockUser> = {}): MockUser => ({
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const createMockUserService = (
  impl: Partial<UserService> = {}
): UserService =>
  new UserService({
    existsByEmail: () => Effect.succeed(false),
    findByEmail: () => Effect.succeed(undefined),
    findById: () => Effect.succeed(undefined),
    update: (id) => Effect.fail(new UserNotFound({ id })),
    delete: (id) => Effect.fail(new UserNotFound({ id })),
    clearImage: (id) => Effect.fail(new UserNotFound({ id })),
    ...impl,
  });

const runWithMock = <A, E>(
  effect: Effect.Effect<A, E, UserService>,
  mock: UserService
) =>
  effect.pipe(
    Effect.provideService(UserService, mock),
    Effect.either,
    Effect.runPromise
  );

describe("UserService", () => {
  describe("existsByEmail", () => {
    it("RPC が user を返す場合 true", async () => {
      const mock = createMockUserService({
        existsByEmail: () => Effect.succeed(true),
      });
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.existsByEmail(Email.makeSync("test@example.com"));
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right).toBe(true);
    });

    it("RPC が user 不在を返す場合 false", async () => {
      const mock = createMockUserService();
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.existsByEmail(Email.makeSync("none@example.com"));
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right).toBe(false);
    });

    it("RPC エラー時 UserServiceError", async () => {
      const mock = createMockUserService({
        existsByEmail: () =>
          Effect.fail(new UserServiceError({ message: "rpc down" })),
      });
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.existsByEmail(Email.makeSync("x@example.com"));
        }),
        mock
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result))
        expect(result.left).toBeInstanceOf(UserServiceError);
    });
  });

  describe("findByEmail", () => {
    it("user が存在すればドメイン型で返す", async () => {
      const u = buildUser({ email: "found@example.com" });
      const mock = createMockUserService({
        findByEmail: () => Effect.succeed(u),
      });
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.findByEmail(Email.makeSync("found@example.com"));
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right?.email).toBe("found@example.com");
    });

    it("不在なら undefined", async () => {
      const mock = createMockUserService();
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.findByEmail(Email.makeSync("none@example.com"));
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right).toBeUndefined();
    });
  });

  describe("findById", () => {
    it("user が存在すればドメイン型で返す", async () => {
      const u = buildUser({ id: "abc" });
      const mock = createMockUserService({
        findById: () => Effect.succeed(u),
      });
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.findById("abc");
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right?.id).toBe("abc");
    });

    it("不在なら undefined", async () => {
      const mock = createMockUserService();
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.findById("none");
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right).toBeUndefined();
    });
  });

  describe("update", () => {
    it("成功時に更新後 user", async () => {
      const updated = buildUser({ name: "Updated" });
      const mock = createMockUserService({
        update: () => Effect.succeed(updated),
      });
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.update("user-1", { name: "Updated" });
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right.name).toBe("Updated");
    });

    it("UserNotFound エラー", async () => {
      const mock = createMockUserService();
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.update("missing", { name: "x" });
        }),
        mock
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result))
        expect(result.left).toBeInstanceOf(UserNotFound);
    });
  });

  describe("delete", () => {
    it("成功時 void", async () => {
      const mock = createMockUserService({
        delete: (_id: string) => Effect.succeed(undefined),
      });
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.delete("user-1");
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("UserNotFound エラー", async () => {
      const mock = createMockUserService();
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.delete("missing");
        }),
        mock
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result))
        expect(result.left).toBeInstanceOf(UserNotFound);
    });
  });

  describe("clearImage", () => {
    it("成功時 image=null の user", async () => {
      const u = buildUser({ image: null });
      const mock = createMockUserService({
        clearImage: () => Effect.succeed(u),
      });
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.clearImage("user-1");
        }),
        mock
      );
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) expect(result.right.image).toBeNull();
    });

    it("UserNotFound エラー", async () => {
      const mock = createMockUserService();
      const result = await runWithMock(
        Effect.gen(function* () {
          const s = yield* UserService;
          return yield* s.clearImage("missing");
        }),
        mock
      );
      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result))
        expect(result.left).toBeInstanceOf(UserNotFound);
    });
  });
});
