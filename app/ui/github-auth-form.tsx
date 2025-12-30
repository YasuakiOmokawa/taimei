"use client";

import { Button } from "@/components/ui/button";
import githubIcon from "@/app/ui/icons/github-mark.png";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { BProgress } from "@bprogress/core";
import { useRedirectPath } from "@/app/lib/hooks/login/useRedirectPath";

export default function GithubAuthForm() {
  const redirectPath = useRedirectPath();

  const handleGithubLogin = () => {
    BProgress.start();
    authClient.signIn.social({
      provider: "github",
      callbackURL: redirectPath,
      errorCallbackURL: "/login?error=signin_failed",
      // 未登録ユーザーの自動登録を防ぎ、新規登録画面への誘導を可能にするため
      additionalData: { mode: "login" },
    });
  };

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleGithubLogin}>
      <Image
        src={githubIcon}
        alt="GitHub icon for login"
        width={100}
        height={100}
        className="h-5 w-5"
      />
      GitHub でログイン
    </Button>
  );
}
