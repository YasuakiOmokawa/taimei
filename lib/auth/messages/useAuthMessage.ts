"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAuthErrorMessage, getAuthSuccessMessage } from "./auth-messages";

export function useAuthMessage() {
  const searchParams = useSearchParams();
  const hasShown = useRef(false);

  useEffect(() => {
    if (hasShown.current) return;

    const errorCode = searchParams.get("error");
    const successCode = searchParams.get("success");

    // エラーを優先、次に成功メッセージを処理
    const message = errorCode
      ? getAuthErrorMessage(errorCode)
      : successCode
        ? getAuthSuccessMessage(successCode)
        : null;

    if (message) {
      const toastFn = errorCode ? toast.error : toast.success;
      toastFn(message);
      hasShown.current = true;
      // URL からクエリパラメータを削除し、ブラウザ履歴に不要な状態を残さない
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);
}
