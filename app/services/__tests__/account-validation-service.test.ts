import { Effect, Either, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { Email } from "@/app/domain/email";
import { AccountAlreadyExists } from "../account-validation-errors";
import {
  type AccountInput,
  AccountValidationService,
} from "../account-validation-service";
import { UserNotFound } from "../user-errors";
import { UserService } from "../user-service";

// UserService は ConnectRPC 経由で auth-service に問い合わせるため、
// テスト用に Layer.succeed でモック実装を注入する。
// 既存メールアドレスは Set で管理する単純なメモリ実装。
const createMockUserServiceLayer = (existingEmails: Set<string>) =>
  Layer.succeed(
    UserService,
    new UserService({
      existsByEmail: (email) =>
        Effect.succeed(existingEmails.has(email as string)),
      findByEmail: () => Effect.succeed(undefined),
      findById: () => Effect.succeed(undefined),
      update: (id) => Effect.fail(new UserNotFound({ id })),
      delete: (id) => Effect.fail(new UserNotFound({ id })),
      clearImage: (id) => Effect.fail(new UserNotFound({ id })),
    }),
  );

const runWithExisting = <A, E>(
  effect: Effect.Effect<A, E, AccountValidationService>,
  existingEmails: Set<string> = new Set(),
) => {
  const mockUserLayer = createMockUserServiceLayer(existingEmails);
  const layer = AccountValidationService.Default.pipe(
    Layer.provide(mockUserLayer),
  );
  return effect.pipe(Effect.provide(layer), Effect.either, Effect.runPromise);
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

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.email).toBe(input.email);
      expect(result.right.name).toBe("New User");
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

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right[0].name).toBe("U1");
      expect(result.right[1].name).toBe("U2");
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

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(AccountAlreadyExists);
      expect(result.left.message).toContain("既に登録されています");
    }
  });
});
