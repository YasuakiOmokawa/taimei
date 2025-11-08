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
      // サンプルコードのため、DB 接続せずハードコードで重複チェックを模倣
      // 実装時は DB から既存アカウントを検索する
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
  /**
   * 本番環境では実際のランダム UUID を生成する必要があるため IdGenerator.Live を使用
   */
  static Live = Layer.effect(
    this,
    makeConformAccountRegistrationService
  ).pipe(Layer.provide(IdGenerator.Live));

  /**
   * スナップショットテストで毎回同じ ID を保証するため IdGenerator.Test を使用
   */
  static Test = Layer.effect(
    this,
    makeConformAccountRegistrationService
  ).pipe(Layer.provide(IdGenerator.Test));

  /**
   * 複数アカウント作成テストで異なる ID が必要なため IdGenerator.TestSequence を使用
   */
  static TestSequence = Layer.effect(
    this,
    makeConformAccountRegistrationService
  ).pipe(Layer.provide(IdGenerator.TestSequence));
}
