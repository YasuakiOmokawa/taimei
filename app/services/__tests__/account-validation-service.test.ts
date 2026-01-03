import { describe, expect } from "vitest";
import { Effect, Either } from "effect";
import {
  AccountValidationService,
  type AccountInput,
  AccountAlreadyExists,
} from "../account-validation-service";
import { Email } from "@/app/domain/email";
import { dbEffect } from "./db/effect-test-helpers";

describe("AccountValidationService", () => {
  describe("validate - DB integration", () => {
    dbEffect("正常系: 新規メールアドレスでバリデーション成功", () =>
      Effect.gen(function* () {
        const input: AccountInput = {
          email: Email.makeSync("newuser@example.com"),
          name: "New User",
        };

        const service = yield* AccountValidationService;
        const validated = yield* service.validate(input);

        expect(validated.email).toBe(input.email);
        expect(validated.name).toBe("New User");
      })
    );

    dbEffect("正常系: 複数の入力をバリデーションできる", () =>
      Effect.gen(function* () {
        const input1: AccountInput = {
          email: Email.makeSync("user1@example.com"),
          name: "User 1",
        };

        const input2: AccountInput = {
          email: Email.makeSync("user2@example.com"),
          name: "User 2",
        };

        const service = yield* AccountValidationService;
        const validated1 = yield* service.validate(input1);
        const validated2 = yield* service.validate(input2);

        expect(validated1.name).toBe("User 1");
        expect(validated2.name).toBe("User 2");
      })
    );

    dbEffect(
      "異常系: 既に存在するメールアドレスで AccountAlreadyExists エラー",
      ({ factory: f }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            f.user.create({ email: "existing@example.com" })
          );

          const input: AccountInput = {
            email: Email.makeSync("existing@example.com"),
            name: "Duplicate User",
          };

          const service = yield* AccountValidationService;
          const result = yield* Effect.either(service.validate(input));

          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left).toBeInstanceOf(AccountAlreadyExists);
            expect(result.left.message).toContain("既に登録されています");
          }
        })
    );
  });
});
