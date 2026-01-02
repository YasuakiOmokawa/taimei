import { describe } from "vitest";
import { it, expect } from "@effect/vitest";
import { Effect, Either, Layer } from "effect";
import {
  ConformAccountRegistrationService,
  type CreateAccountInput,
  AccountAlreadyExists,
} from "../conform-account-registration-service";
import { IdGenerator } from "../id-generator-service";

describe("ConformAccountRegistrationService", () => {
  describe("Test Layer - Fixed UUID", () => {
    it.effect("正常系: アカウントを作成し、固定UUIDが付与される", () =>
      Effect.gen(function* () {
        const input: CreateAccountInput = {
          email: "test@example.com",
          name: "Test User",
        };

        const service = yield* ConformAccountRegistrationService;
        const account = yield* service.execute(input);

        expect(account.id).toBe("0000****-000000000000");
        expect(account.name).toBe("Test User");
      }).pipe(Effect.provide(ConformAccountRegistrationService.Test))
    );

    it.effect("異常系: 重複メールアドレスでエラー", () =>
      Effect.gen(function* () {
        const input: CreateAccountInput = {
          email: "hoge@example.com",
          name: "Duplicate User",
        };

        const service = yield* ConformAccountRegistrationService;
        const result = yield* Effect.either(service.execute(input));

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(AccountAlreadyExists);
        }
      }).pipe(Effect.provide(ConformAccountRegistrationService.Test))
    );
  });

  describe("TestSequence Layer - Sequential UUIDs", () => {
    it.effect("正常系: 連番UUIDでアカウントを複数作成", () =>
      Effect.gen(function* () {
        const input1: CreateAccountInput = {
          email: "user1@example.com",
          name: "User 1",
        };

        const input2: CreateAccountInput = {
          email: "user2@example.com",
          name: "User 2",
        };

        const service = yield* ConformAccountRegistrationService;
        const account1 = yield* service.execute(input1);
        const account2 = yield* service.execute(input2);

        expect(account1.id).toBe("test-uuid-00000");
        expect(account1.name).toBe("User 1");
        expect(account2.id).toBe("test-uuid-00001");
        expect(account2.name).toBe("User 2");
      }).pipe(Effect.provide(ConformAccountRegistrationService.TestSequence))
    );
  });

  describe("Default Layer - Actual UUID Generation", () => {
    const DefaultLayer = ConformAccountRegistrationService.Default.pipe(
      Layer.provide(IdGenerator.Live)
    );

    it.effect("正常系: 本番環境で実際のUUIDを生成", () =>
      Effect.gen(function* () {
        const input: CreateAccountInput = {
          email: "live@example.com",
          name: "Live User",
        };

        const service = yield* ConformAccountRegistrationService;
        const account = yield* service.execute(input);

        // UUID v4 形式の正規表現でバリデーション
        const uuidV4Regex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(account.id).toMatch(uuidV4Regex);
        expect(account.name).toBe("Live User");
      }).pipe(Effect.provide(DefaultLayer))
    );

    it.effect("正常系: 複数回実行して異なるUUIDを生成", () =>
      Effect.gen(function* () {
        const input1: CreateAccountInput = {
          email: "user1@example.com",
          name: "User 1",
        };

        const input2: CreateAccountInput = {
          email: "user2@example.com",
          name: "User 2",
        };

        const service = yield* ConformAccountRegistrationService;
        const account1 = yield* service.execute(input1);
        const account2 = yield* service.execute(input2);

        expect(account1.id).not.toBe(account2.id);
        expect(account1.name).toBe("User 1");
        expect(account2.name).toBe("User 2");
      }).pipe(Effect.provide(DefaultLayer))
    );
  });
});
