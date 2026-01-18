"use server";

import { revalidatePath } from "next/cache";
import { parseWithZod } from "@conform-to/zod/v4";
import { fetchCurrentUser } from "@/app/lib/data";
import { del, put } from "@vercel/blob";
import { userSchema } from "@/app/setting/profile/schema";
import { Effect, Either } from "effect";
import { runService, UserProfileService, UserService } from "@/app/services";

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

function buildUserUpdateData(
  blobUrl: string | undefined,
  parsedValue: Record<string, unknown>
): { name?: string; image?: string } {
  const data: { name?: string; image?: string } = {};

  if (parsedValue.name) {
    data.name = parsedValue.name as string;
  }
  if (blobUrl) {
    data.image = blobUrl;
  }

  return data;
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
  const userData = buildUserUpdateData(blobUrl, submission.value);

  if (submission.value.bio) {
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

  if (Object.keys(userData).length > 0) {
    const result = await runService(() =>
      Effect.gen(function* () {
        const service = yield* UserService;
        return yield* service.update(id, userData);
      })
    );

    if (Either.isLeft(result)) {
      console.error("Failed to update user:", result.left._tag);
    }
  }

  revalidatePath("/setting/profile");
  return submission.reply();
}

export async function deleteAvatar(url: string) {
  if (!url) {
    return { status: "error", message: "URLが指定されていません" };
  }

  if (url.includes("vercel-storage.com")) await del(url);

  const currentUser = await fetchCurrentUser();
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* UserService;
      return yield* service.clearImage(currentUser.id);
    })
  );

  if (Either.isLeft(result)) {
    return { status: "error", message: `Failed to clear avatar: ${result.left._tag}` };
  }

  revalidatePath("/setting/profile");
  return { status: "success" };
}
