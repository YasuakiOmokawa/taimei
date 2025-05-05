import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const userSchema = z.object({
  name: z.string(),
  bio: z.string().optional(),
  avatar: z
    .instanceof(File, { message: "有効なファイルではありません" })
    .optional()
    .refine(
      (file) => {
        if (!file) return true;

        return file.size <= MAX_FILE_SIZE;
      },
      { message: "ファイルサイズは最大5MBまでです" }
    )
    .refine(
      (file) => {
        if (!file) return true;

        return ACCEPTED_IMAGE_TYPES.includes(file.type);
      },
      { message: "JPG、PNG、またはWEBP形式の画像のみアップロード可能です" }
    ),
  avatarUrl: z.string().optional(),
});

export const deleteUserSchema = z.object({
  id: z.string(),
});
