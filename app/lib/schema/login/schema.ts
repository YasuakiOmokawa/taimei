import { z } from "zod";
import { Email } from "@/app/domain/email";

export const emailLinkLoginSchema = z.object({
  email: z
    .email("有効なメールアドレスを入力してください")
    .transform((s) => Email.unsafeFrom(s)),
});
