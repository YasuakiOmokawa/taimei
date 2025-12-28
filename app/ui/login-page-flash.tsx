"use client";

import { useLoginPageFlash } from "@/app/lib/hooks/login/useLoginPageFlash";

// useSearchParams() は Suspense 境界内で使用する必要があるため、専用コンポーネントとして分離
export function LoginPageFlash() {
  useLoginPageFlash();
  return null;
}
