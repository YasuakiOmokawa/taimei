"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { schema } from "./schema";
import { redirect } from "next/navigation";
import { runService } from "@/app/services";
import {
  ConformAccountRegistrationService,
  AccountAlreadyExists,
} from "@/app/services/conform-account-registration-service";
import { Effect, Either } from "effect";
import { setFlash } from "@/lib/flash-toaster";

export async function createData(_prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, {
    schema: schema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const accountOrError = await runService(() =>
    Effect.gen(function* () {
      const service = yield* ConformAccountRegistrationService;
      return yield* service.execute(submission.value);
    })
  );

  if (Either.isLeft(accountOrError)) {
    const err = accountOrError.left;
    if (err instanceof AccountAlreadyExists) {
      return submission.reply({
        fieldErrors: {
          email: [err.message],
        },
        formErrors: ["データの作成に失敗しました"],
      });
    }
    return submission.reply({
      formErrors: [
        "システムエラーが発生しました。しばらくしてから再度お試しください。",
      ],
    });
  }

  await setFlash({ type: "success", message: "データの作成に成功しました。" });
  redirect("/thanks");
}
