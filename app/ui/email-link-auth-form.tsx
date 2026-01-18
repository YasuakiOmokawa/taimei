"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { sendAuthEmailLink } from "@/app/actions/auth";
import { useRedirectPath } from "@/app/lib/hooks/login/useRedirectPath";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { emailLinkLoginSchema } from "@/app/schema/login";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";

export default function EmailLinkAuthForm() {
  const [lastResult, action] = useActionState(
    sendAuthEmailLink.bind(null, useRedirectPath()),
    undefined
  );
  const [form, fields] = useForm({
    lastResult,

    onValidate({ formData }) {
      return parseWithZod(formData, { schema: emailLinkLoginSchema });
    },

    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <form id={form.id} onSubmit={form.onSubmit} action={action} noValidate>
      <div className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            key={fields.email.key}
            type="email"
            name={fields.email.name}
            placeholder="Enter your email address"
            defaultValue={fields.email.value}
          />
          {fields.email.errors && (
            <div className="text-red-500 text-sm">{fields.email.errors}</div>
          )}
        </div>
        <Button type="submit" className="w-full">
          メールで続ける
        </Button>
        {form.errors && (
          <div
            aria-live="polite"
            aria-atomic="true"
            className="flex justify-center items-center space-x-1"
          >
            <ExclamationCircleIcon className="w-5 text-red-500" />
            <p className="text-sm text-red-500">{form.errors}</p>
          </div>
        )}
      </div>
    </form>
  );
}
