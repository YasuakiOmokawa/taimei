import { ConformAccountRegistrationService } from "./conform-account-registration-service";
import { Tag2Service } from "./tag2_service";
import { PgDrizzleLive } from "../layers/lives/pg_drizzle_live";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Tag2Repository } from "./tag2_repository";
import { UserService } from "./user-service";
import { UserRepository } from "./user-repository";
import { UserProfileService } from "./user-profile-service";
import { UserProfileRepository } from "./user-profile-repository";
import { IdGenerator } from "./id-generator-service";
import { DashboardService } from "./dashboard-service";
import { DashboardRepository } from "./dashboard-repository";

// 外部から直接 import できるようにエクスポート（パス簡略化のため）
export { IdGenerator } from "./id-generator-service";
export {
  ConformAccountRegistrationService,
  AccountAlreadyExists,
  type Account,
  type CreateAccountInput,
} from "./conform-account-registration-service";
export { UserService } from "./user-service";
export { UserProfileService, UserProfileNotFound } from "./user-profile-service";
export { UserRepositoryError } from "./user-repository";
export { UserProfileRepositoryError } from "./user-profile-repository";
export { DashboardService, type Revenue, type LatestInvoice, type CardData } from "./dashboard-service";
export { DashboardRepositoryError } from "./dashboard-repository";

// すべてのサービスの依存関係を一箇所で解決するため Layer.mergeAll で統合
export const Live = Layer.mergeAll(
  Tag2Service.Live.pipe(
    Layer.provide(Tag2Repository.Live),
    Layer.provide(PgDrizzleLive)
  ),
  UserService.Live.pipe(
    Layer.provide(UserRepository.Live),
    Layer.provide(PgDrizzleLive)
  ),
  UserProfileService.Live.pipe(
    Layer.provide(UserProfileRepository.Live),
    Layer.provide(IdGenerator.Live),
    Layer.provide(PgDrizzleLive)
  ),
  DashboardService.Live.pipe(
    Layer.provide(DashboardRepository.Live),
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
