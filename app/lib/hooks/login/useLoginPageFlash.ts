import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * テスト容易性のため純粋関数として抽出。Hook 内のサイドエフェクトはテスト戦略上テストしない。
 */
export const shouldShowExistingAccountFlash = (from: string | null): boolean =>
  from === "signup";

/**
 * 新規登録画面からの GitHub OAuth で既存ユーザーがリダイレクトされた場合に使用。
 */
export const useLoginPageFlash = (): void => {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  // React 18 StrictMode では Effect が2回実行されるため、useRef でガード
  const hasShown = useRef(false);

  useEffect(() => {
    // hasShown チェック→設定の順序を変更しないこと（2回実行時の競合防止）
    if (shouldShowExistingAccountFlash(from) && !hasShown.current) {
      hasShown.current = true;
      toast.error("アカウントが既に存在します。ログインしてください。");
      // pushState ではなく replaceState を使用（ブラウザ履歴を汚さない）
      window.history.replaceState({}, "", "/login");
    }
  }, [from]);
};
