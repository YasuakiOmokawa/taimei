import { AccountValidationService } from "./account-validation-service";
import { Tag2Service } from "./tag2-service";
import { PgDrizzleLive } from "../layers/lives/pg_drizzle_live";
import { Effect, Layer, ManagedRuntime } from "effect";
import { UserService } from "./user-service";
import { UserProfileService } from "./user-profile-service";
import { IdGenerator } from "./id-generator-service";
import { DashboardService } from "./dashboard-service";
import { InvoiceService } from "./invoice-service";
import { CustomerService } from "./customer-service";
import { AuthService } from "./auth-service";

// 外部から直接 import できるようにエクスポート（パス簡略化のため）
export { IdGenerator } from "./id-generator-service";
export {
  AccountValidationService,
  type AccountInput,
} from "./account-validation-service";
export { AccountAlreadyExists } from "./account-validation-errors";
export { UserService } from "./user-service";
export { UserNotFound, UserServiceError } from "./user-errors";
export { UserProfileService } from "./user-profile-service";
export {
  UserProfileNotFound,
  UserProfileServiceError,
} from "./user-profile-errors";
export {
  DashboardService,
  type Revenue,
  type LatestInvoice,
  type CardData,
} from "./dashboard-service";
export { DashboardServiceError } from "./dashboard-errors";
export {
  InvoiceService,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
} from "./invoice-service";
export { InvoiceNotFound, InvoiceServiceError } from "./invoice-errors";
export { CustomerService } from "./customer-service";
export { CustomerServiceError } from "./customer-errors";
export { Tag2Service } from "./tag2-service";
export {
  Tag2NotFound,
  Tag2ParseError,
  Tag2ServiceError,
} from "./tag2-errors";
export { AuthService } from "./auth-service";
export {
  AuthServiceError,
  MagicLinkError,
  SessionError,
  SignOutError,
  UserNotFoundError,
  UserAlreadyExistsError,
} from "./auth-errors";

// すべてのサービスの依存関係を一箇所で解決するため Layer.mergeAll で統合
// Effect.Service は .Default、Effect.Tag は .Live を使用
// 共有 Layer: 二重構築を防ぐため変数化
const UserServiceLive = UserService.Default.pipe(Layer.provide(PgDrizzleLive));

export const Live = Layer.mergeAll(
  Tag2Service.Default.pipe(Layer.provide(PgDrizzleLive)),
  UserServiceLive,
  UserProfileService.Default.pipe(
    Layer.provide(IdGenerator.Live),
    Layer.provide(PgDrizzleLive)
  ),
  DashboardService.Default.pipe(Layer.provide(PgDrizzleLive)),
  InvoiceService.Default.pipe(Layer.provide(PgDrizzleLive)),
  CustomerService.Default.pipe(Layer.provide(PgDrizzleLive)),
  AccountValidationService.Default.pipe(Layer.provide(UserServiceLive)),
  AuthService.Default.pipe(Layer.provide(PgDrizzleLive))
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
