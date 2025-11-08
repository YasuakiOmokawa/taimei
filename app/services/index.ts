import { ConformAccountRegistrationService } from "./conform-account-registration-service";
import { Tag2Service } from "./tag2_service";
import { PgDrizzleLive } from "../layers/lives/pg_drizzle_live";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Tag2Repository } from "./tag2_repository";

// 外部から直接 import できるようにエクスポート（パス簡略化のため）
export { IdGenerator } from "./id-generator-service";
export {
  ConformAccountRegistrationService,
  AccountAlreadyExists,
  type Account,
  type CreateAccountInput,
} from "./conform-account-registration-service";

// すべてのサービスの依存関係を一箇所で解決するため Layer.mergeAll で統合
export const Live = Layer.mergeAll(
  Tag2Service.Live.pipe(
    Layer.provide(Tag2Repository.Live),
    Layer.provide(PgDrizzleLive)
  ),
  ConformAccountRegistrationService.Live
);

// Next.js の Server Actions から Effect を実行するため、
// ManagedRuntime でリソース管理（DB 接続プール等）を自動化
export const makeNextRuntime = <R, E>(layer: Layer.Layer<R, E, never>) => {
  const runtime = ManagedRuntime.make(layer);
  const run = <A, E>(body: () => Effect.Effect<A, E, R>) =>
    runtime.runPromise(Effect.either(body()));
  return { run };
};

export const { run: runService } = makeNextRuntime(Live);
