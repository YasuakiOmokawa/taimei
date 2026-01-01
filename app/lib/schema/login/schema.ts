import { z } from "zod";

export const emailLinkLoginSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
});
