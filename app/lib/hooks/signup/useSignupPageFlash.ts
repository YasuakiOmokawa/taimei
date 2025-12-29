import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { shouldShowAccountNotLinkedFlash } from "@/app/lib/hooks/login/useLoginPageFlash";

/**
 * signup ページでのクライアント側フラッシュメッセージ表示
 *
 * 対象シナリオ:
 * - error=account_not_linked: Magic Link 登録済みユーザーが GitHub で登録試行
 */
export const useSignupPageFlash = (): void => {
  const searchParams = useSearchParams();
  const errors = searchParams.getAll("error");
  const hasShown = useRef(false);

  useEffect(() => {
    if (hasShown.current) return;

    if (shouldShowAccountNotLinkedFlash(errors)) {
      hasShown.current = true;
      toast.error(
        "このメールアドレスのアカウントは既に存在します。ログイン後、設定画面からGitHubを連携できます。"
      );
      window.history.replaceState({}, "", "/signup");
    }
  }, [errors]);
};
