"use server";

import { revalidatePath } from "next/cache";
import { parseWithZod } from "@conform-to/zod/v4";
import { fetchCurrentUser } from "@/app/lib/data";
import { del, put } from "@vercel/blob";
import { userSchema } from "./schema";
import { Effect, Either } from "effect";
import { runService, UserProfileService } from "@/app/services";

async function updateAvatar(
  id: string,
  parsedValue: {
    avatarUrl?: string | undefined;
    avatar?: File | undefined;
  }
) {
  if (
    parsedValue.avatarUrl &&
    parsedValue.avatarUrl.includes("vercel-storage.com")
  ) {
    await del(parsedValue.avatarUrl);
  }

  if (parsedValue.avatar) {
    const blob = await put(
      `avatars/${id}/${Date.now()}-${parsedValue.avatar.name}`,
      parsedValue.avatar,
      {
        access: "public",
        contentType: parsedValue.avatar.type,
      }
    );
    return blob.url;
  }
}

async function buildUpdateUserQuery(
  id: string,
  blobUrl: string | undefined,
  parsedValue: Record<string, unknown>
) {
  const updateColumn: Record<string, unknown> = {
    name: parsedValue.name,
  };

  if (blobUrl) updateColumn.image = blobUrl;

  return {
    data: updateColumn,
    where: {
      id: id,
    },
  };
}

export async function updateUser(
  id: string,
  _prevState: unknown,
  formData: FormData
) {
  const submission = parseWithZod(formData, { schema: userSchema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const blobUrl = await updateAvatar(id, { ...submission.value });
  const updateUserQuery = await buildUpdateUserQuery(
    id,
    blobUrl,
    submission.value
  );

  if (submission.value.bio) {
    // Effect-TSサービス経由でUserProfile更新
    const result = await runService(() =>
      Effect.gen(function* () {
        const service = yield* UserProfileService;
        return yield* service.upsert(id, submission.value.bio ?? "");
      })
    );

    if (Either.isLeft(result)) {
      console.error("Failed to update user profile:", result.left._tag);
    }
  }
  // TODO: User.name/image更新機能のEffect-TS移行
  console.warn("updateUser: User table update not implemented yet", updateUserQuery);

  revalidatePath("/setting/profile");
  return submission.reply();
}

export async function deleteAvatar(url: string) {
  if (!url) {
    return { status: "error", message: "URLが指定されていません" };
  }

  if (url.includes("vercel-storage.com")) await del(url);

  // TODO: User.image削除機能のEffect-TS移行
  const currentUser = await fetchCurrentUser();
  console.warn("deleteAvatar: User table update not implemented yet", currentUser.id);

  revalidatePath("/setting/profile");
  return { status: "success" };
}
