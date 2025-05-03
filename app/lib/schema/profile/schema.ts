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
    .instanceof(File)
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "ファイルサイズは最大5MBまでです"
    )
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
      "JPG、PNG、またはWEBP形式の画像のみアップロード可能です"
    )
    .optional(),
  avatarUrl: z.string().optional(),
});

export const avatarSchema = userSchema.pick({
  avatar: true,
});

export const deleteUserSchema = z.object({
  id: z.string(),
});
