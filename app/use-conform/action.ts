"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { schema } from "./schema";
import { redirect } from "next/navigation";
import { runService } from "@/app/services";
import { AccountValidationService } from "@/app/services/account-validation-service";
import { Effect, Either } from "effect";
import { setFlash } from "@/lib/flash-toaster";
import { Email } from "@/app/domain/email";

export async function createData(_prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, {
    schema: schema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* AccountValidationService;
      return yield* service.validate({
        email: Email.fromTrusted(submission.value.email),
        name: submission.value.name,
      });
    })
  );

  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "AccountAlreadyExists":
        return submission.reply({
          fieldErrors: {
            email: [result.left.message],
          },
          formErrors: ["データの作成に失敗しました"],
        });
      default:
        return submission.reply({
          formErrors: [
            "システムエラーが発生しました。しばらくしてから再度お試しください。",
          ],
        });
    }
  }

  await setFlash({ type: "success", message: "データの作成に成功しました。" });
  redirect("/thanks");
}
