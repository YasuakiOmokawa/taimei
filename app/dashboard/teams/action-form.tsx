"use client";

import { useActionState, useRef } from "react";
import type { FailureMessage } from "@/app/lib/team-failure";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

export function ActionForm({
  action,
  submitLabel,
  irreversibleWarning,
  children,
}: {
  action: (
    state: FailureMessage,
    formData: FormData,
  ) => Promise<FailureMessage>;
  submitLabel: string;
  irreversibleWarning?: string;
  children?: React.ReactNode;
}) {
  const [failure, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction}>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {irreversibleWarning ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {submitLabel}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{submitLabel}</AlertDialogTitle>
                <AlertDialogDescription>
                  {irreversibleWarning}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={() => formRef.current?.requestSubmit()}
                >
                  {submitLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button type="submit" size="sm" disabled={pending}>
            {submitLabel}
          </Button>
        )}
      </div>
      {failure && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {failure}
        </p>
      )}
    </form>
  );
}
