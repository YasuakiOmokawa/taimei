import { Effect, Layer, ManagedRuntime } from "effect";
import { resolveCompanyIdOrRedirect } from "../lib/auth-guard";
import { AuthClient } from "./auth-client-service";
import { AuthService } from "./auth-service";
import { CompanyContext } from "./company-context";
import { CookieReader } from "./cookie-reader-service";
import { Db } from "./db-service";

const Live = Layer.mergeAll(
  Db.layer,
  AuthService.layer.pipe(
    Layer.provide(CookieReader.layer),
    Layer.provide(AuthClient.layer),
  ),
);

// runtime も返し、runScopedService が runtime を再構築せず同じ ManagedRuntime を共有する (docs/adr/0002 D3)。
const makeNextRuntime = <R, E>(layer: Layer.Layer<R, E, never>) => {
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
