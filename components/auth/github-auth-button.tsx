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
      // OAuth 失敗時は taimei-auth (Layer B) のエラー画面に遷移する。中間期間 (PR10a/b で
      // taimei 側旧 auth UI 削除前) 用の暫定。Better Auth は absolute URL をそのまま 302 先と
      // して使うため cross-origin (app → auth) 遷移可能。env で env 切替可能 (PR5b で導入)。
      errorCallbackURL: `${process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.taimei-code.com"}/auth/error?reason=signin_failed`,
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
