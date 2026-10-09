import { Effect, Layer, ManagedRuntime, Result } from "effect";
import { resolveCompanyIdOrRedirect } from "../lib/auth-guard";
import { reportUnexpectedFailure } from "../lib/team-failure";
import { AuthorizationContext } from "./authorization-context";
import { CompanyContext } from "./company-context";
import { CompanyMembers } from "./company-members-service";
import { Db, DbUnavailable } from "./db-service";
import type { TeamFailure } from "./team-errors";
import { TeamManagement, TeamService } from "./team-service";

const Live = CompanyMembers.layer;
type LiveServices = Layer.Success<typeof Live>;

// Db を要る Service。実行口が request ごとに、RLS の事業所を設定した transaction の Db で作る (docs/adr/0005)
const RequestScoped = TeamService.layer;
// 組み立てが管理者でないと NotManager で失敗するので、メンバーも通る RequestScoped に混ぜない
const ManagerScoped = TeamManagement.layer;

const runtime = ManagedRuntime.make(Live);

const reportingUnexpectedFailure = <A, E extends TeamFailure>(
  result: Result.Result<A, E>,
) => {
  if (Result.isFailure(result)) reportUnexpectedFailure(result.failure);
  return result;
};

export const runService = <A, E extends TeamFailure>(
  body: () => Effect.Effect<A, E, LiveServices>,
) => runtime.runPromise(Effect.result(body())).then(reportingUnexpectedFailure);

type ProvidedPerRequest = Db | CompanyContext | AuthorizationContext;

// CompanyContext・AuthorizationContext を Live に含めると session 無しで実行できてしまう (docs/adr/0002 D3)
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

// companyId を引数で受けず session から導く理由は docs/adr/0002-company-data-scoping.md (D3)
const runInCompanyScope = async <A, E extends TeamFailure>(
  body: () => Effect.Effect<A, E, LiveServices | ProvidedPerRequest>,
): Promise<Result.Result<A, E | DbUnavailable>> => {
  const { companyId, session } = await resolveCompanyIdOrRedirect();
  // ponytail: CompanyMembers の RPC を待つ間も接続を 1 本持つ (上限は auth の RPC の timeout)。pool が足りなくなったら RPC を transaction の外に出す
  let result: Result.Result<A, E | DbUnavailable>;
  try {
    result = await Db.inCompanyScope(companyId, (tx) =>
      runtime
        .runPromise(
          Effect.result(
            body().pipe(
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
    result = Result.fail(new DbUnavailable({ cause: error }));
  }
  return reportingUnexpectedFailure(result);
};

// Service の union を手書きすると、Layer に足した Service が実行口の型から漏れる
export const runScopedService = <A, E extends TeamFailure>(
  body: () => Effect.Effect<
    A,
    E,
    LiveServices | Layer.Success<typeof RequestScoped> | ProvidedPerRequest
  >,
) => runInCompanyScope(() => body().pipe(Effect.provide(RequestScoped)));

export const runManagerScopedService = <A, E extends TeamFailure>(
  body: () => Effect.Effect<
    A,
    E,
    LiveServices | Layer.Success<typeof ManagerScoped> | ProvidedPerRequest
  >,
) => runInCompanyScope(() => body().pipe(Effect.provide(ManagerScoped)));
