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
import { UserProfileSelectionById } from "@/app/lib/data";

type Props = {
  userProfile: UserProfileSelectionById | null;
};

export function EditForm({ userProfile }: Props) {
  const { data: session } = useSession();
  const [lastResult, action] = useActionState(
    withCallbacks(updateUser.bind(null, String(session?.user?.id)), {
      onSuccess() {
        toast.success("プロフィールが更新されました");
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
          他のユーザーかに公開される情報です。
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
            id="name"
            type="text"
            key={fields.name.key}
            name={fields.name.name}
            defaultValue={fields.name.value ?? session?.user?.name ?? ""}
            placeholder="山田太郎"
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
            key={fields.bio.key}
            name={fields.bio.name}
            className="min-h-[100px]"
            defaultValue={fields.bio.value ?? userProfile?.bio}
            placeholder="こんにちは！"
          />
          <p className="text-xs text-muted-foreground">
            あなたについて紹介してください。
          </p>
          <div className="text-red-500">{fields.bio.errors}</div>
        </div>

        <Button type="submit">更新</Button>
      </form>
    </div>
  );
}
