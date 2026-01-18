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
  AccountAlreadyExists,
  type AccountInput,
} from "./account-validation-service";
export { UserService, UserNotFound, UserServiceError } from "./user-service";
export {
  UserProfileService,
  UserProfileNotFound,
  UserProfileServiceError,
} from "./user-profile-service";
export { DashboardService, DashboardServiceError, type Revenue, type LatestInvoice, type CardData } from "./dashboard-service";
export {
  InvoiceService,
  InvoiceNotFound,
  InvoiceServiceError,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
} from "./invoice-service";
export { CustomerService, CustomerServiceError } from "./customer-service";
export { AuthService, AuthServiceError } from "./auth-service";
export {
  MagicLinkError,
  SessionError,
  SignOutError,
  UserNotFoundError,
  UserAlreadyExistsError,
} from "./auth-errors";

// すべてのサービスの依存関係を一箇所で解決するため Layer.mergeAll で統合
// Effect.Service は .Default、Effect.Tag は .Live を使用
export const Live = Layer.mergeAll(
  Tag2Service.Default.pipe(Layer.provide(PgDrizzleLive)),
  UserService.Default.pipe(Layer.provide(PgDrizzleLive)),
  UserProfileService.Default.pipe(
    Layer.provide(IdGenerator.Live),
    Layer.provide(PgDrizzleLive)
  ),
  DashboardService.Default.pipe(Layer.provide(PgDrizzleLive)),
  InvoiceService.Default.pipe(Layer.provide(PgDrizzleLive)),
  CustomerService.Default.pipe(Layer.provide(PgDrizzleLive)),
  AccountValidationService.Default.pipe(
    Layer.provide(UserService.Default.pipe(Layer.provide(PgDrizzleLive)))
  ),
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
