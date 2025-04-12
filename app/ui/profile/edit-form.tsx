"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useActionState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { userSchema } from "@/app/lib/schema/profile/schema";
import { updateUser } from "@/app/lib/actions";
import { withCallbacks } from "@/lib/with-callbacks";
import { toast } from "sonner";

export function EditForm() {
  const { data: session } = useSession();
  const [lastResult, action] = useActionState(
    withCallbacks(updateUser.bind(null, String(session?.user?.id)), {
      onSuccess() {
        toast.success("profile updated");
      },
    }),
    undefined
  );
  const [form, fields] = useForm({
    lastResult,

    onValidate({ formData }) {
      return parseWithZod(formData, { schema: userSchema });
    },

    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">プロフィール</h3>
        <p className="text-sm text-muted-foreground">
          他のユーザーから見える情報です。
        </p>
      </div>
      <Separator />
      <form
        className="space-y-8"
        id={form.id}
        onSubmit={form.onSubmit}
        action={action}
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="name">表示名</Label>
          <Input
            type="text"
            key={fields.name.key}
            name={fields.name.name}
            defaultValue={fields.name.value ?? String(session?.user?.name)}
            placeholder="John Doe"
          />
          <p className="text-xs text-muted-foreground">
            他のユーザーから見える名前です。
          </p>
          <div className="text-red-500">{fields.name.errors}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">自己紹介</Label>
          <Textarea
            id="bio"
            className="min-h-[100px]"
            defaultValue="こんにちは！"
          />
          <p className="text-xs text-muted-foreground">
            あなたについて紹介してください。
          </p>
        </div>

        <Button type="submit">更新</Button>
      </form>
    </div>
  );
}
