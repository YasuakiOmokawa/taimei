import { Effect } from "effect";
import { Email } from "@/app/domain/email";
import { AccountAlreadyExists } from "./account-validation-errors";
import { UserService } from "./user-service";

export type AccountInput = {
  readonly email: Email;
  readonly name: string;
};

export class AccountValidationService extends Effect.Service<AccountValidationService>()(
  "services/AccountValidationService",
  {
    effect: Effect.gen(function* () {
      const userService = yield* UserService;

      const checkEmailNotExists = (email: Email) =>
        Effect.gen(function* () {
          const exists = yield* userService.existsByEmail(email);
          if (exists) {
            return yield* new AccountAlreadyExists({
              message:
                "入力したemailは既に登録されています。別のemailを入力してください。",
            });
          }
        });

      return {
        validate: (input: AccountInput) =>
          Effect.gen(function* () {
            yield* checkEmailNotExists(input.email);
            return input;
          }),
      } as const;
    }),
  },
) {}
