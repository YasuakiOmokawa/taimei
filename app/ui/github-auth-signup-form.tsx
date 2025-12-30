"use client";

import { Button } from "@/components/ui/button";
import githubIcon from "@/app/ui/icons/github-mark.png";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { BProgress } from "@bprogress/core";
import { useRedirectPath } from "@/app/lib/hooks/login/useRedirectPath";

export default function GithubAuthSignupForm() {
  const redirectPath = useRedirectPath();

  const handleGithubSignup = () => {
    BProgress.start();
    // 既存ユーザーはログイン画面に戻し、新規ユーザーのみ signup フローを続行
    authClient.signIn.social({
      provider: "github",
      callbackURL: "/login?from=signup",
      newUserCallbackURL: redirectPath,
      errorCallbackURL: "/signup?error=signup_failed",
    });
  };

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleGithubSignup}>
      <Image
        src={githubIcon}
        alt="GitHub icon for signup"
        width={100}
        height={100}
        className="h-5 w-5"
      />
      GitHub で登録
    </Button>
  );
}
