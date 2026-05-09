import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { Email } from "../email";

describe("Email", () => {
  describe("make", () => {
    it("有効なメールアドレスで Right を返す", () => {
      const result = Email.make("test@example.com");

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBe("test@example.com");
      }
    });

    it("+タグ付きメールアドレスを許可する", () => {
      const result = Email.make("user+tag@example.com");

      expect(Either.isRight(result)).toBe(true);
    });

    it("ドット区切りローカル部を許可する", () => {
      const result = Email.make("user.name@example.com");

      expect(Either.isRight(result)).toBe(true);
    });

    it("サブドメイン付きを許可する", () => {
      const result = Email.make("user@sub.example.com");

      expect(Either.isRight(result)).toBe(true);
    });

    it("無効なメールアドレスで Left を返す", () => {
      const result = Email.make("invalid");

      expect(Either.isLeft(result)).toBe(true);
    });

    it("@がないメールアドレスを拒否する", () => {
      const result = Email.make("test.example.com");

      expect(Either.isLeft(result)).toBe(true);
    });

    it("空文字列を拒否する", () => {
      const result = Email.make("");

      expect(Either.isLeft(result)).toBe(true);
    });

    it("ローカル部がないメールアドレスを拒否する", () => {
      const result = Email.make("@example.com");

      expect(Either.isLeft(result)).toBe(true);
    });

    it("ドメイン部がないメールアドレスを拒否する", () => {
      const result = Email.make("user@");

      expect(Either.isLeft(result)).toBe(true);
    });

    it("スペースを含むメールアドレスを拒否する", () => {
      const result = Email.make("user @example.com");

      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("makeSync", () => {
    it("有効なメールアドレスで Email を返す", () => {
      const email = Email.makeSync("test@example.com");

      expect(email).toBe("test@example.com");
    });

    it("無効なメールアドレスで例外を投げる", () => {
      expect(() => Email.makeSync("invalid")).toThrow();
    });
  });

  describe("fromTrusted", () => {
    it("バリデーションなしで Email 型を生成する", () => {
      const email = Email.fromTrusted("test@example.com");

      expect(email).toBe("test@example.com");
    });
  });
});
