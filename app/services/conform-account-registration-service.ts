import { Data, Effect, Layer } from "effect";
import { IdGenerator } from "./id-generator-service";

export class AccountAlreadyExists extends Data.TaggedError(
  "AccountAlreadyExists"
)<{
  message: string;
}> {}

export type CreateAccountInput = {
  readonly email: string;
  readonly name: string;
};

export type Account = {
  readonly id: string;
  readonly name: string;
};

const makeConformAccountRegistrationService = Effect.gen(function* () {
  const idGenerator = yield* IdGenerator;

  const validateAccount = (email: string) =>
    Effect.gen(function* () {
      // FIXME: 現在はサンプル実装のため hoge@example.com を重複とみなす
      // 理想: DB から既存アカウントを検索して実際の重複チェックを行う
      // 妥協理由: Effect-TS のサービスパターンの実装例を示すことを優先
      if (email === "hoge@example.com") {
        return yield* new AccountAlreadyExists({
          message:
            "入力したemailは既に登録されています。別のemailを入力してください。",
        });
      }
    });

  const execute = (input: CreateAccountInput) =>
    Effect.gen(function* () {
      yield* validateAccount(input.email);

      const id = yield* idGenerator.generate;
      const account: Account = { id, name: input.name };
      return account;
    });

  return {
    execute,
  };
});

export class ConformAccountRegistrationService extends Effect.Tag(
  "services/ConformAccountRegistrationService"
)<
  ConformAccountRegistrationService,
  Effect.Effect.Success<typeof makeConformAccountRegistrationService>
>() {
  private static makeLayer = (idGeneratorLayer: Layer.Layer<IdGenerator>) =>
    Layer.effect(this, makeConformAccountRegistrationService).pipe(
      Layer.provide(idGeneratorLayer)
    );

  static Live = this.makeLayer(IdGenerator.Live);
  static Test = this.makeLayer(IdGenerator.Test);
  static TestSequence = this.makeLayer(IdGenerator.TestSequence);
}
