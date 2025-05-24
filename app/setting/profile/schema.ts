import { z } from "zod/v4";

export const FILE_SIZE_PREFIX = 1;
const MAX_FILE_SIZE = FILE_SIZE_PREFIX * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const userSchema = z.object({
  name: z.string(),
  bio: z.string().optional(),
  avatar: z.custom<File>().transform((file, ctx) => {
    // 画像が未選択でも更新を許可するため
    if (file.size === 0) return undefined;

    if (file.size > MAX_FILE_SIZE) {
      ctx.addIssue({
        code: "custom",
        message: `ファイルサイズは最大${FILE_SIZE_PREFIX}MBまでです`,
      });
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      ctx.addIssue({
        code: "custom",
        message: "JPG、PNG、またはWEBP形式の画像のみアップロード可能です",
      });
    }

    return file;
  }),
  avatarUrl: z.string().optional(),
});

export const deleteUserSchema = z.object({
  id: z.string(),
});
