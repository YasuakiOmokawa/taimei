import { Effect, Layer, ManagedRuntime, Result } from "effect";
import { resolveCompanyIdOrRedirect } from "../lib/auth-guard";
import { AuthClient } from "./auth-client-service";
import { AuthService } from "./auth-service";
import { AuthorizationContext } from "./authorization-context";
import { CompanyContext } from "./company-context";
import { CompanyMembers } from "./company-members-service";
import { CookieReader } from "./cookie-reader-service";
import { Db, DbUnavailable } from "./db-service";
import { TeamService } from "./team-service";

const Live = Layer.mergeAll(
  AuthService.layer.pipe(
    Layer.provide(CookieReader.layer),
    Layer.provide(AuthClient.layer),
  ),
  CompanyMembers.layer,
);

// Db を要る Service。runScopedService が request ごとに、RLS の事業所を設定した transaction の Db で作る (docs/adr/0005)
const RequestScoped = TeamService.layer;

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
// AllScopedServices は Live と RequestScoped の ROut から機械導出する (手書き union 禁止 = Service 追加時の漏れ防止)。
type AllScopedServices =
  | Layer.Success<typeof Live>
  | Layer.Success<typeof RequestScoped>;

// CompanyContext・AuthorizationContext を Live に含めると session 無しで実行できてしまう (docs/adr/0002 D3)
type LiveServices = Layer.Success<typeof Live>;
type _NoRequestContextInLive = [CompanyContext] extends [LiveServices]
  ? "ERROR: CompanyContext must NOT be in Live"
  : [AuthorizationContext] extends [LiveServices]
    ? "ERROR: AuthorizationContext must NOT be in Live"
    : [Db] extends [LiveServices]
      ? "ERROR: Db must NOT be in Live"
      : true;
const _assertNoRequestContextInLive: _NoRequestContextInLive = true;

class BodyDefect {
  constructor(readonly defect: unknown) {}
}

// 事業所スコープ処理の唯一の実行口。companyId は引数で受けず境界の内側で session から導出する
// (呼出側が間違った/欠けた companyId を渡す経路を API から消す)。
// 未選択判定 + redirect は requireCompany と共有 (resolveCompanyIdOrRedirect、redirect SSOT)。
export const runScopedService = async <A, E>(
  body: () => Effect.Effect<
    A,
    E,
    AllScopedServices | Db | CompanyContext | AuthorizationContext
  >,
): Promise<Result.Result<A, E | DbUnavailable>> => {
  const { companyId, session } = await resolveCompanyIdOrRedirect();
  // ponytail: CompanyMembers の RPC を待つ間も接続を 1 本持つ (上限は auth の RPC の timeout)。pool が足りなくなったら RPC を transaction の外に出す
  try {
    return await Db.inCompanyScope(companyId, (tx) =>
      runtime
        .runPromise(
          Effect.result(
            body().pipe(
              Effect.provide(RequestScoped),
              Effect.provideService(Db, tx),
              Effect.provideService(CompanyContext, { companyId }),
              Effect.provideService(AuthorizationContext, {
                userId: session.user.id,
                role: session.role,
              }),
            ),
          ),
        )
        .catch((defect: unknown) => {
          throw new BodyDefect(defect);
        }),
    );
  } catch (error) {
    if (error instanceof BodyDefect) throw error.defect;
    return Result.fail(new DbUnavailable({ cause: error }));
  }
};
