"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { BProgress } from "@bprogress/core";
import { useRedirectPath } from "@/app/lib/hooks/login/useRedirectPath";

export default function GithubAuthButton() {
  const redirectPath = useRedirectPath();

  const handleGithubAuth = () => {
    BProgress.start();
    // Better Auth は relative path を auth-service の baseURL 相対で解決するため、
    // taimei オリジンへ戻すには絶対 URL を渡す必要がある
    const origin = window.location.origin;
    authClient.signIn.social({
      provider: "github",
      callbackURL: `${origin}${redirectPath}`,
      // OAuth 失敗時は統合認証ページにリダイレクト（エラー表示 + 再試行導線）
      errorCallbackURL: `${origin}/auth?error=signin_failed`,
    });
  };

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleGithubAuth}>
      <Image
        src="/icons/github-mark.png"
        alt="GitHub icon"
        width={100}
        height={100}
        className="h-5 w-5"
      />
      GitHub で続ける
    </Button>
  );
}
