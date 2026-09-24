import { Effect, Layer, ManagedRuntime } from "effect";
import { resolveCompanyIdOrRedirect } from "../lib/auth-guard";
import { AccountValidationService } from "./account-validation-service";
import { AuthClient } from "./auth-client-service";
import { AuthService } from "./auth-service";
import { CompanyContext } from "./company-context";
import { CookieReader } from "./cookie-reader-service";
import { CustomerService } from "./customer-service";
import { DashboardService } from "./dashboard-service";
import { Db } from "./db-service";
import { InvoiceService } from "./invoice-service";
import { Tag2Service } from "./tag2-service";
import { UserService } from "./user-service";

export { AccountAlreadyExists } from "./account-validation-errors";
export {
  type AccountInput,
  AccountValidationService,
} from "./account-validation-service";
export { SessionError } from "./auth-errors";
export { AuthService } from "./auth-service";
export { CompanyContext, type CompanyContextShape } from "./company-context";
// CookieReader / CookieReadError は AuthService の内部依存として非公開
// (Layer 配線でのみ使用、外部は AuthService の API のみを利用する)。
export { CustomerServiceError } from "./customer-errors";
export { CustomerService } from "./customer-service";
export { DashboardServiceError } from "./dashboard-errors";
export {
  type CardData,
  DashboardService,
  type LatestInvoice,
  type Revenue,
} from "./dashboard-service";
export { IdGenerator } from "./id-generator-service";
export {
  CustomerNotInScope,
  InvoiceNotFound,
  InvoiceServiceError,
} from "./invoice-errors";
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
export { UserServiceError } from "./user-errors";
export { UserService } from "./user-service";

const UserServiceLive = UserService.layer.pipe(Layer.provide(AuthClient.layer));

export const Live = Layer.mergeAll(
  Layer.mergeAll(
    Tag2Service.layer,
    DashboardService.layer,
    InvoiceService.layer,
    CustomerService.layer,
  ).pipe(Layer.provide(Db.layer)),
  UserServiceLive,
  AccountValidationService.layer.pipe(Layer.provide(UserServiceLive)),
  AuthService.layer.pipe(
    Layer.provide(CookieReader.layer),
    Layer.provide(AuthClient.layer),
  ),
);

// Next.js の Server Actions から Effect を実行するため、
// ManagedRuntime でリソース管理（DB 接続プール等）を自動化。
// runtime も返すことで scoped/非 scoped が同一 ManagedRuntime を共有する
// (runScopedService が runtime を再構築して層分離を崩すのを防ぐ。docs/adr/0002 D3)。
export const makeNextRuntime = <R, E>(layer: Layer.Layer<R, E, never>) => {
  const runtime = ManagedRuntime.make(layer);
  const run = <A, E2>(body: () => Effect.Effect<A, E2, R>) =>
    runtime.runPromise(Effect.result(body()));
  return { run, runtime };
};

const { run: runService, runtime } = makeNextRuntime(Live);

export { runService };

// 事業所スコープ実行の閉じ。設計詳細: docs/adr/0002-company-data-scoping.md (D3)。
// AllScopedServices は Live の ROut から機械導出する (手書き union 禁止 = Service 追加時の漏れ防止)。
type AllScopedServices = Layer.Success<typeof Live>;

// IDOR backstop 番兵 (閉じ1 を規律でなく型で固定): CompanyContext を Live に含めると
// companyId 無し実行が型で通り backstop が破れる。含めた瞬間に下行がコンパイルエラーになる。
type _NoCompanyContextInLive = [CompanyContext] extends [AllScopedServices]
  ? "ERROR: CompanyContext must NOT be in Live"
  : true;
const _assertNoCompanyContextInLive: _NoCompanyContextInLive = true;

// 事業所スコープ処理の唯一の実行口。companyId は引数で受けず境界の内側で session から導出する
// (呼出側が間違った/欠けた companyId を渡す経路を API から消す)。
// 未選択判定 + redirect は requireCompany と共有 (resolveCompanyIdOrRedirect、redirect SSOT)。
export const runScopedService = async <A, E>(
  body: () => Effect.Effect<A, E, AllScopedServices | CompanyContext>,
) => {
  const { companyId } = await resolveCompanyIdOrRedirect();
  return runtime.runPromise(
    Effect.result(
      body().pipe(Effect.provideService(CompanyContext, { companyId })),
    ),
  );
};
