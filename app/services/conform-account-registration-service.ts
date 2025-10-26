import { Data, Effect, Layer } from "effect";

class AccountAlreadyExists extends Data.TaggedError("AccountAlreadyExists")<{
  message: string;
}> {}

const makeConformAccountResistrationService = Effect.gen(function* () {
  const validateAccount = (email: string) =>
    Effect.gen(function* () {
      if (email === "hoge@example.com") {
        return yield* new AccountAlreadyExists({
          message:
            "入力したemailは既に登録されています。別のemailを入力してください。",
        });
      }
    });

  const execute = ({ email, name }: { email: string; name: string }) =>
    Effect.gen(function* () {
      yield* validateAccount(email);

      const account = { id: self.crypto.randomUUID(), name: name };
      return account;
    });

  return {
    execute,
  };
});

export class ConformAccountResistrationService extends Effect.Tag(
  "services/ConformAccountResistrationService"
)<
  ConformAccountResistrationService,
  Effect.Effect.Success<typeof makeConformAccountResistrationService>
>() {
  static Live = Layer.effect(this, makeConformAccountResistrationService);
}
