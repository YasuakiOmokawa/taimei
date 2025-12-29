import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// テスト容易性のため純粋関数として抽出
export const shouldShowExistingAccountFlash = (from: string | null): boolean =>
  from === "signup";

export const shouldShowAccountNotLinkedFlash = (
  errors: string[]
): boolean => errors.includes("account_not_linked");

/**
 * ログインページでのクライアント側フラッシュメッセージ表示
 *
 * 対象シナリオ:
 * - error=account_not_linked: Magic Link 登録済みユーザーが GitHub でログイン試行
 * - from=signup: signup 画面から GitHub OAuth で既存ユーザーがリダイレクト
 *
 * from=signup でエラーなしの場合はサーバー側フラッシュに任せる。
 */
export const useLoginPageFlash = (): void => {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const errors = searchParams.getAll("error");
  const hasShown = useRef(false);

  useEffect(() => {
    if (hasShown.current) return;

    if (shouldShowAccountNotLinkedFlash(errors)) {
      hasShown.current = true;
      toast.error(
        "このメールアドレスのアカウントは既に存在します。ログイン後、設定画面からGitHubを連携できます。"
      );
      // replaceState でブラウザ履歴を汚さない（戻るボタンでクエリパラメータ付きURLに戻らない）
      window.history.replaceState({}, "", "/login");
    } else if (shouldShowExistingAccountFlash(from)) {
      hasShown.current = true;
      toast.error("アカウントが既に存在します。ログインしてください。");
      window.history.replaceState({}, "", "/login");
    }
  }, [from, errors]);
};
