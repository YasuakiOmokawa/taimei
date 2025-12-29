import { describe, it, expect, vi } from "vitest";
import { GenericEndpointContext } from "@better-auth/core";
import { handleUserCreateBefore } from "@/lib/auth/hooks/user-create-hook";

describe("handleUserCreateBefore", () => {
  describe("ログインモード（state.mode === 'login'）", () => {
    it("未登録ユーザーの場合、flash Cookie を設定して /signup にリダイレクト", async () => {
      const mockSetCookie = vi.fn();
      const redirectError = new Error("redirect to /signup");
      const mockRedirect = vi.fn(() => {
        throw redirectError;
      });

      const mockCtx = {
        setCookie: mockSetCookie,
        redirect: mockRedirect,
      } as unknown as GenericEndpointContext;
      const mockGetOAuthState = vi.fn().mockResolvedValue({ mode: "login" });

      await expect(
        handleUserCreateBefore({ id: "123" }, mockCtx, mockGetOAuthState)
      ).rejects.toThrow(redirectError);

      expect(mockSetCookie).toHaveBeenCalledWith(
        "flash",
        JSON.stringify({
          type: "error",
          message: "アカウントが存在しません。新規登録してください。",
        }),
        { maxAge: 1 }
      );
      expect(mockRedirect).toHaveBeenCalledWith("/signup");
    });

    it("ctx が undefined の場合、エラーをスロー", async () => {
      const mockGetOAuthState = vi.fn().mockResolvedValue({ mode: "login" });

      await expect(
        handleUserCreateBefore({ id: "123" }, undefined, mockGetOAuthState)
      ).rejects.toThrow(
        "Cannot create user in login mode: context not available"
      );
    });
  });

  describe("サインアップモード（state.mode === 'signup'）", () => {
    it("ユーザーデータをそのまま返す", async () => {
      const mockGetOAuthState = vi.fn().mockResolvedValue({ mode: "signup" });
      const user = { id: "123", name: "Test User" };

      const result = await handleUserCreateBefore(
        user,
        undefined,
        mockGetOAuthState
      );

      expect(result).toEqual({ data: user });
    });
  });

  describe("OAuth state が存在しない場合", () => {
    it("state が null の場合、ユーザーデータをそのまま返す", async () => {
      const mockGetOAuthState = vi.fn().mockResolvedValue(null);
      const user = { id: "123", name: "Test User" };

      const result = await handleUserCreateBefore(
        user,
        undefined,
        mockGetOAuthState
      );

      expect(result).toEqual({ data: user });
    });

    it("state.mode が undefined の場合、ユーザーデータをそのまま返す", async () => {
      const mockGetOAuthState = vi.fn().mockResolvedValue({});
      const user = { id: "123", name: "Test User" };

      const result = await handleUserCreateBefore(
        user,
        undefined,
        mockGetOAuthState
      );

      expect(result).toEqual({ data: user });
    });
  });
});
