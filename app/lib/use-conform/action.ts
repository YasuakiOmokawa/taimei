"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { schema } from "./schema";
import { redirect } from "next/navigation";
import { runService } from "@/app/services";
import { ConformAccountResistrationService } from "@/app/services/conform-account-registration-service";
import { Either } from "effect";

export async function createData(_prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, {
    schema: schema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const accountOrError = await runService(() =>
    ConformAccountResistrationService.execute(submission.value)
  );

  if (Either.isLeft(accountOrError)) {
    const err = accountOrError.left;
    switch (err._tag) {
      case "AccountAlreadyExists":
        return submission.reply({
          fieldErrors: {
            email: [err.message],
          },
        });
      default:
        return submission.reply({
          formErrors: [
            "システムエラーが発生しました。しばらくしてから再度お試しください。",
          ],
        });
    }
  }

  redirect("/thanks");
}
