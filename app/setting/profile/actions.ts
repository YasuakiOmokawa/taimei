"use server";

import { revalidatePath } from "next/cache";
import { parseWithZod } from "@conform-to/zod";
import { prisma } from "@/prisma";
import { fetchCurrentUser } from "@/app/lib/data";
import { del, put } from "@vercel/blob";
import { userSchema } from "./schema";

async function updateAvatar(
  id: string,
  parsedValue: {
    avatarUrl?: string;
    avatar?: File;
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
    await prisma.$transaction([
      prisma.user.update(updateUserQuery),
      prisma.userProfile.upsert({
        where: {
          userId: id,
        },
        update: {
          bio: submission.value.bio,
        },
        create: {
          bio: submission.value.bio,
          userId: id,
        },
      }),
    ]);
  } else {
    prisma.user.update(updateUserQuery);
  }

  revalidatePath("/setting/profile");
  return submission.reply();
}

export async function deleteAvatar(url: string) {
  if (!url) {
    return { status: "error", message: "URLが指定されていません" };
  }

  if (url.includes("vercel-storage.com")) await del(url);
  await prisma.user.update({
    data: {
      image: null,
    },
    where: {
      id: (await fetchCurrentUser()).id,
    },
  });

  revalidatePath("/setting/profile");
  return { status: "success" };
}
