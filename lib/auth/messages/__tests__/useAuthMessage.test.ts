import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthMessage } from "../useAuthMessage";

const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
  },
}));

const mockReplaceState = vi.fn();

describe("useAuthMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);

    // window.history.replaceState をモック
    Object.defineProperty(window, "history", {
      value: { replaceState: mockReplaceState },
      writable: true,
    });

    Object.defineProperty(window, "location", {
      value: { pathname: "/auth" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("エラーコード処理", () => {
    it("正常系: 有効なエラーコードでtoast.errorを呼び出す", () => {
      mockGet.mockImplementation((key: string) =>
        key === "error" ? "signin_failed" : null,
      );

      renderHook(() => useAuthMessage());

      expect(mockToastError).toHaveBeenCalledWith("ログインに失敗しました。");
      expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/auth");
    });

    it("正常系: magic_link_failedエラーで適切なメッセージを表示", () => {
      mockGet.mockImplementation((key: string) =>
        key === "error" ? "magic_link_failed" : null,
      );

      renderHook(() => useAuthMessage());

      expect(mockToastError).toHaveBeenCalledWith("メール送信に失敗しました。");
    });

    it("異常系: 無効なエラーコードではtoastを呼び出さない", () => {
      mockGet.mockImplementation((key: string) =>
        key === "error" ? "invalid_code" : null,
      );

      renderHook(() => useAuthMessage());

      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockReplaceState).not.toHaveBeenCalled();
    });
  });

  describe("成功コード処理", () => {
    it("正常系: 有効な成功コードでtoast.successを呼び出す", () => {
      mockGet.mockImplementation((key: string) =>
        key === "success" ? "logged_in" : null,
      );

      renderHook(() => useAuthMessage());

      expect(mockToastSuccess).toHaveBeenCalledWith("ログインしました");
      expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/auth");
    });

    it("正常系: magic_link_sent成功で適切なメッセージを表示", () => {
      mockGet.mockImplementation((key: string) =>
        key === "success" ? "magic_link_sent" : null,
      );

      renderHook(() => useAuthMessage());

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "認証リンクをメールで送信しました。",
      );
    });

    it("異常系: 無効な成功コードではtoastを呼び出さない", () => {
      mockGet.mockImplementation((key: string) =>
        key === "success" ? "invalid_code" : null,
      );

      renderHook(() => useAuthMessage());

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockReplaceState).not.toHaveBeenCalled();
    });
  });

  describe("重複表示防止", () => {
    it("正常系: 同じコードで複数回呼び出されてもtoastは1回のみ", () => {
      mockGet.mockImplementation((key: string) =>
        key === "error" ? "signin_failed" : null,
      );

      const { rerender } = renderHook(() => useAuthMessage());
      rerender();
      rerender();

      expect(mockToastError).toHaveBeenCalledTimes(1);
    });
  });

  describe("パラメータなし", () => {
    it("正常系: パラメータがない場合はtoastを呼び出さない", () => {
      mockGet.mockReturnValue(null);

      renderHook(() => useAuthMessage());

      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockReplaceState).not.toHaveBeenCalled();
    });
  });

  describe("エラー優先", () => {
    it("正常系: errorとsuccessの両方がある場合はerrorを優先", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "error") return "signin_failed";
        if (key === "success") return "logged_in";
        return null;
      });

      renderHook(() => useAuthMessage());

      expect(mockToastError).toHaveBeenCalledWith("ログインに失敗しました。");
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });
});
