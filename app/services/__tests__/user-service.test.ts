import { describe } from "vitest";
import { expect } from "@effect/vitest";
import { Effect, Either } from "effect";
import { UserService } from "../user-service";
import { UserNotFound } from "../user-errors";
import { dbEffect } from "./db/effect-test-helpers";
import { Email } from "@/app/domain/email";

describe("UserService", () => {
  describe("update", () => {
    dbEffect("正常系: ユーザー名を更新できる", ({ factory: f }) =>
      Effect.gen(function* () {
        const created = yield* Effect.promise(() => f.user.create());

        const service = yield* UserService;
        const updated = yield* service.update(created.id, {
          name: "Updated Name",
        });

        expect(updated.name).toBe("Updated Name");
      })
    );

    dbEffect("正常系: ユーザー画像を更新できる", ({ factory: f }) =>
      Effect.gen(function* () {
        const created = yield* Effect.promise(() => f.user.create());

        const service = yield* UserService;
        const updated = yield* service.update(created.id, {
          image: "https://example.com/new-avatar.png",
        });

        expect(updated.image).toBe("https://example.com/new-avatar.png");
      })
    );

    dbEffect("異常系: 存在しないユーザーを更新しようとするとエラー", () =>
      Effect.gen(function* () {
        const service = yield* UserService;
        const result = yield* Effect.either(
          service.update("non-existent-id", { name: "New Name" })
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(UserNotFound);
        }
      })
    );
  });

  describe("delete", () => {
    dbEffect("正常系: ユーザーを削除できる", ({ factory: f }) =>
      Effect.gen(function* () {
        const created = yield* Effect.promise(() => f.user.create());

        const service = yield* UserService;
        yield* service.delete(created.id);
      })
    );

    dbEffect("異常系: 存在しないユーザーを削除しようとするとエラー", () =>
      Effect.gen(function* () {
        const service = yield* UserService;
        const result = yield* Effect.either(service.delete("non-existent-id"));

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(UserNotFound);
        }
      })
    );
  });

  describe("clearImage", () => {
    dbEffect("正常系: ユーザー画像をクリアできる", ({ factory: f }) =>
      Effect.gen(function* () {
        const created = yield* Effect.promise(() =>
          f.user.create({
            image: "https://example.com/avatar.png",
          })
        );

        const service = yield* UserService;
        const updated = yield* service.clearImage(created.id);

        expect(updated.image).toBeNull();
      })
    );

    dbEffect(
      "異常系: 存在しないユーザーの画像をクリアしようとするとエラー",
      () =>
        Effect.gen(function* () {
          const service = yield* UserService;
          const result = yield* Effect.either(
            service.clearImage("non-existent-id")
          );

          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left).toBeInstanceOf(UserNotFound);
          }
        })
    );
  });

  describe("existsByEmail", () => {
    dbEffect("正常系: 存在するメールアドレスで true を返す", ({ factory: f }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          f.user.create({ email: "test@example.com" })
        );

        const service = yield* UserService;
        const exists = yield* service.existsByEmail(
          Email.makeSync("test@example.com")
        );

        expect(exists).toBe(true);
      })
    );

    dbEffect("正常系: 存在しないメールアドレスで false を返す", () =>
      Effect.gen(function* () {
        const service = yield* UserService;
        const exists = yield* service.existsByEmail(
          Email.makeSync("nonexistent@example.com")
        );

        expect(exists).toBe(false);
      })
    );
  });

  describe("findByEmail", () => {
    dbEffect(
      "正常系: メールアドレスでユーザーを検索できる",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const created = yield* Effect.promise(() =>
            f.user.create({ email: "test@example.com" })
          );

          const service = yield* UserService;
          const user = yield* service.findByEmail(
            Email.makeSync("test@example.com")
          );

          expect(user?.id).toBe(created.id);
          expect(user?.email).toBe("test@example.com");
        })
    );

    dbEffect("正常系: 存在しないメールアドレスでundefinedを返す", () =>
      Effect.gen(function* () {
        const service = yield* UserService;
        const user = yield* service.findByEmail(
          Email.makeSync("nonexistent@example.com")
        );

        expect(user).toBeUndefined();
      })
    );
  });

  describe("findById", () => {
    dbEffect("正常系: IDでユーザーを検索できる", ({ factory: f }) =>
      Effect.gen(function* () {
        const created = yield* Effect.promise(() => f.user.create());

        const service = yield* UserService;
        const user = yield* service.findById(created.id);

        expect(user?.id).toBe(created.id);
      })
    );

    dbEffect("正常系: 存在しないIDでundefinedを返す", () =>
      Effect.gen(function* () {
        const service = yield* UserService;
        const user = yield* service.findById("non-existent-id");

        expect(user).toBeUndefined();
      })
    );
  });
});
