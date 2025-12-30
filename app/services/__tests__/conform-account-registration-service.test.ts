import { describe, it, expect } from "vitest";
import { Effect, Either, Layer } from "effect";
import {
  ConformAccountRegistrationService,
  type CreateAccountInput,
  AccountAlreadyExists,
} from "../conform-account-registration-service";
import { IdGenerator } from "../id-generator-service";
import { runWithLayer } from "./test-helpers";

describe("ConformAccountRegistrationService", () => {
  describe("Test Layer - Fixed UUID", () => {
    it("正常系: アカウントを作成し、固定UUIDが付与される", async () => {
      const input: CreateAccountInput = {
        email: "test@example.com",
        name: "Test User",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* ConformAccountRegistrationService;
          return yield* service.execute(input);
        }),
        ConformAccountRegistrationService.Test
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.id).toBe("0000****-000000000000");
        expect(result.right.name).toBe("Test User");
      }
    });

    it("異常系: 重複メールアドレスでエラー", async () => {
      const input: CreateAccountInput = {
        email: "hoge@example.com",
        name: "Duplicate User",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* ConformAccountRegistrationService;
          return yield* service.execute(input);
        }),
        ConformAccountRegistrationService.Test
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(AccountAlreadyExists);
      }
    });
  });

  describe("TestSequence Layer - Sequential UUIDs", () => {
    it("正常系: 連番UUIDでアカウントを複数作成", async () => {
      const input1: CreateAccountInput = {
        email: "user1@example.com",
        name: "User 1",
      };

      const input2: CreateAccountInput = {
        email: "user2@example.com",
        name: "User 2",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* ConformAccountRegistrationService;
          const account1 = yield* service.execute(input1);
          const account2 = yield* service.execute(input2);
          return [account1, account2];
        }),
        ConformAccountRegistrationService.TestSequence
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right[0].id).toBe("test-uuid-00000");
        expect(result.right[0].name).toBe("User 1");
        expect(result.right[1].id).toBe("test-uuid-00001");
        expect(result.right[1].name).toBe("User 2");
      }
    });
  });

  describe("Default Layer - Actual UUID Generation", () => {
    it("正常系: 本番環境で実際のUUIDを生成", async () => {
      const input: CreateAccountInput = {
        email: "live@example.com",
        name: "Live User",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* ConformAccountRegistrationService;
          return yield* service.execute(input);
        }),
        ConformAccountRegistrationService.Default.pipe(
          Layer.provide(IdGenerator.Live)
        )
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        // UUID v4 形式の正規表現でバリデーション
        const uuidV4Regex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(result.right.id).toMatch(uuidV4Regex);
        expect(result.right.name).toBe("Live User");
      }
    });

    it("正常系: 複数回実行して異なるUUIDを生成", async () => {
      const input1: CreateAccountInput = {
        email: "user1@example.com",
        name: "User 1",
      };

      const input2: CreateAccountInput = {
        email: "user2@example.com",
        name: "User 2",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* ConformAccountRegistrationService;
          const account1 = yield* service.execute(input1);
          const account2 = yield* service.execute(input2);
          return [account1, account2];
        }),
        ConformAccountRegistrationService.Default.pipe(
          Layer.provide(IdGenerator.Live)
        )
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right[0].id).not.toBe(result.right[1].id);
        expect(result.right[0].name).toBe("User 1");
        expect(result.right[1].name).toBe("User 2");
      }
    });
  });
});
