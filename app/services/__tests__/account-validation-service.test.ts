import { Effect, Layer, Result } from "effect";
import { describe, expect, it } from "vitest";
import { Email } from "@/app/domain/email";
import { AccountAlreadyExists } from "../account-validation-errors";
import {
  type AccountInput,
  AccountValidationService,
} from "../account-validation-service";
import { UserService } from "../user-service";

// UserService は ConnectRPC 経由で auth-service に問い合わせるため、
// テスト用に Layer.succeed でモック実装を注入する。
// 既存メールアドレスは Set で管理する単純なメモリ実装。
const createMockUserServiceLayer = (existingEmails: Set<string>) =>
  Layer.succeed(
    UserService,
    UserService.of({
      existsByEmail: (email) =>
        Effect.succeed(existingEmails.has(Email.asString(email))),
      findByEmail: () => Effect.succeed(undefined),
      findById: () => Effect.succeed(undefined),
    }),
  );

const runWithExisting = <A, E>(
  effect: Effect.Effect<A, E, AccountValidationService>,
  existingEmails: Set<string> = new Set(),
) => {
  const mockUserLayer = createMockUserServiceLayer(existingEmails);
  const layer = AccountValidationService.layer.pipe(
    Layer.provide(mockUserLayer),
  );
  return effect.pipe(Effect.provide(layer), Effect.result, Effect.runPromise);
};

describe("AccountValidationService", () => {
  it("正常系: 新規メールアドレスでバリデーション成功", async () => {
    const input: AccountInput = {
      email: Email.makeSync("newuser@example.com"),
      name: "New User",
    };

    const result = await runWithExisting(
      Effect.gen(function* () {
        const service = yield* AccountValidationService;
        return yield* service.validate(input);
      }),
    );

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.email).toBe(input.email);
      expect(result.success.name).toBe("New User");
    }
  });

  it("正常系: 複数の入力をバリデーションできる", async () => {
    const result = await runWithExisting(
      Effect.gen(function* () {
        const service = yield* AccountValidationService;
        const v1 = yield* service.validate({
          email: Email.makeSync("u1@example.com"),
          name: "U1",
        });
        const v2 = yield* service.validate({
          email: Email.makeSync("u2@example.com"),
          name: "U2",
        });
        return [v1, v2] as const;
      }),
    );

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success[0].name).toBe("U1");
      expect(result.success[1].name).toBe("U2");
    }
  });

  it("異常系: 既存メールアドレスで AccountAlreadyExists", async () => {
    const result = await runWithExisting(
      Effect.gen(function* () {
        const service = yield* AccountValidationService;
        return yield* service.validate({
          email: Email.makeSync("existing@example.com"),
          name: "Duplicate",
        });
      }),
      new Set(["existing@example.com"]),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(AccountAlreadyExists);
      expect(result.failure.message).toContain("既に登録されています");
    }
  });
});
