"use client";

import { cn } from "@/lib/utils";
import GithubAuthButton from "@/components/auth/github-auth-button";
import AuthFormHeader from "./auth-form-header";
import MyServiceName from "./my-service-name";
import EmailLinkAuthForm from "@/components/auth/email-link-auth-form";
import AuthFormFooter from "./auth-form-footer";

export function AuthForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <AuthFormHeader />
          <h1 className="text-xl font-bold">
            <MyServiceName /> へようこそ
          </h1>
        </div>
        <EmailLinkAuthForm />
        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-background px-2 text-muted-foreground">
            Or
          </span>
        </div>
        <div className="grid gap-4">
          <GithubAuthButton />
        </div>
      </div>
      <AuthFormFooter />
    </div>
  );
}
