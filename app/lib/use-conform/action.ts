"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { schema } from "./schema";
import { redirect } from "next/navigation";
import { runService } from "@/app/services";
import { ConformAccountResistrationService } from "@/app/services/conform-account-registration-service";

export async function createData(_prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, {
    schema: schema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const _accountOrError = await runService(() =>
    ConformAccountResistrationService.execute(submission.value)
  );

  redirect("/thanks");
}
