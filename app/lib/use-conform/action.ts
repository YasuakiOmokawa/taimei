"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { schema } from "./schema";
import { redirect } from "next/navigation";
// import { runService } from "@/app/services";

export async function createData(_prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, {
    schema: schema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  // TODO: あとで具体の実装をしよう
  // const accountOrError = await runService(() => ConformAccountService.create());

  redirect("/thanks");
}
