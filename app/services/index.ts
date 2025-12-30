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
import { InvoiceService } from "./invoice-service";
import { InvoiceRepository } from "./invoice-repository";
import { CustomerService } from "./customer-service";
import { CustomerRepository } from "./customer-repository";
import { AuthService } from "./auth-service";
import { AuthRepository } from "./auth-repository";

// 外部から直接 import できるようにエクスポート（パス簡略化のため）
export { IdGenerator } from "./id-generator-service";
export {
  ConformAccountRegistrationService,
  AccountAlreadyExists,
  type Account,
  type CreateAccountInput,
} from "./conform-account-registration-service";
export { UserService, UserNotFound } from "./user-service";
export { UserProfileService, UserProfileNotFound } from "./user-profile-service";
export { UserRepositoryError } from "./user-repository";
export { UserProfileRepositoryError } from "./user-profile-repository";
export { DashboardService, type Revenue, type LatestInvoice, type CardData } from "./dashboard-service";
export { DashboardRepositoryError } from "./dashboard-repository";
export { InvoiceService, InvoiceNotFound } from "./invoice-service";
export { InvoiceRepositoryError, type CreateInvoiceInput, type UpdateInvoiceInput } from "./invoice-repository";
export { CustomerService } from "./customer-service";
export { CustomerRepositoryError } from "./customer-repository";
export { AuthService } from "./auth-service";
export { AuthRepositoryError } from "./auth-repository";
export {
  MagicLinkError,
  SessionError,
  SignOutError,
  SessionInvalidateError,
  UserNotFoundError,
  UserAlreadyExistsError,
} from "./auth-errors";

// すべてのサービスの依存関係を一箇所で解決するため Layer.mergeAll で統合
// Effect.Service は .Default、Effect.Tag は .Live を使用
export const Live = Layer.mergeAll(
  Tag2Service.Default.pipe(
    Layer.provide(Tag2Repository.Default),
    Layer.provide(PgDrizzleLive)
  ),
  UserService.Default.pipe(
    Layer.provide(UserRepository.Default),
    Layer.provide(PgDrizzleLive)
  ),
  UserProfileService.Default.pipe(
    Layer.provide(UserProfileRepository.Default),
    Layer.provide(IdGenerator.Live),
    Layer.provide(PgDrizzleLive)
  ),
  DashboardService.Default.pipe(
    Layer.provide(DashboardRepository.Default),
    Layer.provide(PgDrizzleLive)
  ),
  InvoiceService.Default.pipe(
    Layer.provide(InvoiceRepository.Default),
    Layer.provide(PgDrizzleLive)
  ),
  CustomerService.Default.pipe(
    Layer.provide(CustomerRepository.Default),
    Layer.provide(PgDrizzleLive)
  ),
  ConformAccountRegistrationService.Default.pipe(Layer.provide(IdGenerator.Live)),
  AuthService.Default.pipe(
    Layer.provide(AuthRepository.Default),
    Layer.provide(PgDrizzleLive)
  )
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
