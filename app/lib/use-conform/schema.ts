import { z } from "zod/v4";

export const schema = z.object({
  email: z.email({
    error: (issue) =>
      issue.input === undefined
        ? "Eメールは必須です"
        : "メールアドレスの形式が正しくありません。",
  }),
  name: z.string(),
});
