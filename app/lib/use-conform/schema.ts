import { z } from "zod";
import { Email } from "@/app/domain/email";

export const schema = z.object({
  email: z
    .email({
      error: (issue) =>
        issue.input === undefined
          ? "Eメールは必須です"
          : "メールアドレスの形式が正しくありません。",
    })
    .transform((s) => Email.unsafeFrom(s)),
  name: z.string(),
});
