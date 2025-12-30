import { describe, it, expect } from "vitest";
import {
  AuthErrorCode,
  AuthSuccessCode,
  AUTH_ERROR_MESSAGES,
  AUTH_SUCCESS_MESSAGES,
  getAuthErrorMessage,
  getAuthSuccessMessage,
} from "../auth-messages";

describe("auth-messages", () => {
  describe("AuthErrorCode", () => {
    it("正常系: すべてのエラーコードが定義されている", () => {
      expect(AuthErrorCode.USER_NOT_FOUND).toBe("user_not_found");
      expect(AuthErrorCode.USER_ALREADY_EXISTS).toBe("user_already_exists");
      expect(AuthErrorCode.MAGIC_LINK_FAILED).toBe("magic_link_failed");
      expect(AuthErrorCode.LOGIN_UNREGISTERED).toBe("login_unregistered");
      expect(AuthErrorCode.ACCOUNT_NOT_LINKED).toBe("account_not_linked");
      expect(AuthErrorCode.SIGNIN_FAILED).toBe("signin_failed");
      expect(AuthErrorCode.SIGNUP_FAILED).toBe("signup_failed");
    });
  });

  describe("AuthSuccessCode", () => {
    it("正常系: すべての成功コードが定義されている", () => {
      expect(AuthSuccessCode.ACCOUNT_CREATED).toBe("account_created");
      expect(AuthSuccessCode.LOGGED_IN).toBe("logged_in");
      expect(AuthSuccessCode.MAGIC_LINK_SENT).toBe("magic_link_sent");
      expect(AuthSuccessCode.LOGGED_OUT).toBe("logged_out");
    });
  });

  describe("AUTH_ERROR_MESSAGES", () => {
    it("正常系: すべてのエラーコードに対応するメッセージがある", () => {
      Object.values(AuthErrorCode).forEach((code) => {
        expect(AUTH_ERROR_MESSAGES[code]).toBeDefined();
        expect(typeof AUTH_ERROR_MESSAGES[code]).toBe("string");
      });
    });
  });

  describe("AUTH_SUCCESS_MESSAGES", () => {
    it("正常系: すべての成功コードに対応するメッセージがある", () => {
      Object.values(AuthSuccessCode).forEach((code) => {
        expect(AUTH_SUCCESS_MESSAGES[code]).toBeDefined();
        expect(typeof AUTH_SUCCESS_MESSAGES[code]).toBe("string");
      });
    });
  });

  describe("getAuthErrorMessage", () => {
    it("正常系: 有効なエラーコードでメッセージを返す", () => {
      expect(getAuthErrorMessage("user_not_found")).toBe(
        "アカウントが存在しません。"
      );
      expect(getAuthErrorMessage("magic_link_failed")).toBe(
        "メール送信に失敗しました。"
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
        "アカウントを作成しました"
      );
      expect(getAuthSuccessMessage("logged_in")).toBe("ログインしました");
    });

    it("異常系: 無効な成功コードで undefined を返す", () => {
      expect(getAuthSuccessMessage("invalid_code")).toBeUndefined();
      expect(getAuthSuccessMessage("")).toBeUndefined();
    });
  });
});
