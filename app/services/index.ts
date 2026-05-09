import { Effect, Layer, ManagedRuntime } from "effect";
import { PgDrizzleLive } from "../layers/lives/pg_drizzle_live";
import { AccountValidationService } from "./account-validation-service";
import { AuthService } from "./auth-service";
import { CustomerService } from "./customer-service";
import { DashboardService } from "./dashboard-service";
import { IdGenerator } from "./id-generator-service";
import { InvoiceService } from "./invoice-service";
import { Tag2Service } from "./tag2-service";
import { UserProfileService } from "./user-profile-service";
import { UserService } from "./user-service";

export { AccountAlreadyExists } from "./account-validation-errors";
export {
  type AccountInput,
  AccountValidationService,
} from "./account-validation-service";
export {
  AuthServiceError,
  MagicLinkError,
  SessionError,
  SignOutError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from "./auth-errors";
export { AuthService } from "./auth-service";
export { CustomerServiceError } from "./customer-errors";
export { CustomerService } from "./customer-service";
export { DashboardServiceError } from "./dashboard-errors";
export {
  type CardData,
  DashboardService,
  type LatestInvoice,
  type Revenue,
} from "./dashboard-service";
// 外部から直接 import できるようにエクスポート（パス簡略化のため）
export { IdGenerator } from "./id-generator-service";
export { InvoiceNotFound, InvoiceServiceError } from "./invoice-errors";
export {
  type CreateInvoiceInput,
  InvoiceService,
  type UpdateInvoiceInput,
} from "./invoice-service";
export {
  Tag2NotFound,
  Tag2ParseError,
  Tag2ServiceError,
} from "./tag2-errors";
export { Tag2Service } from "./tag2-service";
export { UserNotFound, UserServiceError } from "./user-errors";
export {
  UserProfileNotFound,
  UserProfileServiceError,
} from "./user-profile-errors";
export { UserProfileService } from "./user-profile-service";
export { UserService } from "./user-service";

// すべてのサービスの依存関係を一箇所で解決するため Layer.mergeAll で統合
// Effect.Service は .Default、Effect.Tag は .Live を使用
// AuthService と UserService は ConnectRPC クライアントを内部で生成するため PgDrizzleLive 不要
const UserServiceLive = UserService.Default;

export const Live = Layer.mergeAll(
  Tag2Service.Default.pipe(Layer.provide(PgDrizzleLive)),
  UserServiceLive,
  UserProfileService.Default.pipe(
    Layer.provide(IdGenerator.Live),
    Layer.provide(PgDrizzleLive),
  ),
  DashboardService.Default.pipe(Layer.provide(PgDrizzleLive)),
  InvoiceService.Default.pipe(Layer.provide(PgDrizzleLive)),
  CustomerService.Default.pipe(Layer.provide(PgDrizzleLive)),
  AccountValidationService.Default.pipe(Layer.provide(UserServiceLive)),
  AuthService.Default,
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
