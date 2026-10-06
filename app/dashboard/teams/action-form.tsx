"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FailureMessage } from "./failure-message";

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

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (irreversibleWarning && !window.confirm(irreversibleWarning))
          event.preventDefault();
      }}
    >
      <div className="flex items-center gap-2">
        {children}
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          variant={irreversibleWarning ? "outline" : "default"}
        >
          {submitLabel}
        </Button>
      </div>
      {failure && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {failure}
        </p>
      )}
    </form>
  );
}
