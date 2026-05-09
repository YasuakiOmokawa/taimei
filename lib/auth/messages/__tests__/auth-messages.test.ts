import { describe, expect, it } from "vitest";
import { getAuthErrorMessage, getAuthSuccessMessage } from "../auth-messages";

describe("auth-messages", () => {
  describe("getAuthErrorMessage", () => {
    it("正常系: 有効なエラーコードでメッセージを返す", () => {
      expect(getAuthErrorMessage("magic_link_failed")).toBe(
        "メール送信に失敗しました。",
      );
      expect(getAuthErrorMessage("signin_failed")).toBe(
        "ログインに失敗しました。",
      );
    });

    it("異常系: 無効なエラーコードで undefined を返す", () => {
      expect(getAuthErrorMessage("invalid_code")).toBeUndefined();
      expect(getAuthErrorMessage("")).toBeUndefined();
    });
  });

  describe("getAuthSuccessMessage", () => {
    it("正常系: 有効な成功コードでメッセージを返す", () => {
      expect(getAuthSuccessMessage("account_created")).toBe(
        "アカウントを作成しました",
      );
      expect(getAuthSuccessMessage("logged_in")).toBe("ログインしました");
    });

    it("異常系: 無効な成功コードで undefined を返す", () => {
      expect(getAuthSuccessMessage("invalid_code")).toBeUndefined();
      expect(getAuthSuccessMessage("")).toBeUndefined();
    });
  });
});
