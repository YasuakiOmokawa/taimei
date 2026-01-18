"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAuthErrorMessage, getAuthSuccessMessage } from "./auth-messages";

export function useAuthMessage() {
  const searchParams = useSearchParams();
  const hasShown = useRef(false);

  const errorCode = searchParams.get("error");
  const successCode = searchParams.get("success");

  useEffect(() => {
    if (hasShown.current) return;

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
  }, [errorCode, successCode]);
}
