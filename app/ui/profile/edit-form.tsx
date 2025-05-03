"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useActionState } from "react";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { userSchema } from "@/app/lib/schema/profile/schema";
import { updateUser } from "@/app/lib/actions";
import { withCallbacks } from "@/lib/with-callbacks";
import { toast } from "sonner";
import type { CurrentUser, UserProfileSelectionById } from "@/app/lib/data";
import { useCurrentUser } from "@/app/lib/hooks/useCurrentUser";
import { AvatarUpload } from "@/components/avatar-upload";

type Props = {
  user: CurrentUser;
  userProfile: UserProfileSelectionById | null;
};

export function EditForm({ userProfile, user }: Props) {
  const [lastResult, action] = useActionState(
    withCallbacks(updateUser.bind(null, String(user.id)), {
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h3 className="text-lg font-medium">プロフィール</h3>
        <p className="text-sm text-muted-foreground">
          他のユーザーに公開される情報です。
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
        <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] gap-8">
          <div className="space-y-6">
            {/* プロフィールフィールドのコンテナ */}
            <div className="space-y-2">
              <Label htmlFor="name">表示名</Label>
              <Input
                id="name"
                type="text"
                key={fields.name.key}
                name={fields.name.name}
                defaultValue={fields.name.value ?? user.name}
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

            {/* 将来的なフィールド用のスペース */}
            {/* 新しいフィールドはここに追加 */}

            <div className="pt-4">
              <Button type="submit">更新</Button>
            </div>
          </div>

          {/* アバターアップロードコンポーネント - 右側に固定 */}
          <div className="md:sticky md:top-8">
            <AvatarUpload avatarUrl={user.image} userName={user.name} />
          </div>
        </div>
      </form>
    </div>
  );
}
