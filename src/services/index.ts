import { Effect, Layer, ManagedRuntime, Result } from "effect";
import { db } from "@/db/drizzle/client";
import { withCompanyScope } from "@/db/scoped";
import { reportUnexpectedFailure } from "@/src/lib/team-failure";
import { AuthorizationContext } from "./authorization-context";
import { CompanyContext } from "./company-context";
import { Db, DbUnavailable } from "./db-service";
import type { TeamFailure } from "./team-errors";
import { TeamService } from "./team-service";

export type RequestSession = CompanyContext["Service"] &
  AuthorizationContext["Service"] & { readonly userName: string };

const Live = Layer.empty;
type LiveServices = Layer.Success<typeof Live>;

// Db を要る Service。実行口が request ごとに、RLS の事業所を設定した transaction の Db で作る (docs/adr/0005)
const RequestScoped = TeamService.layer;

const runtime = ManagedRuntime.make(Live);

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

// drizzle は callback が throw した時にしか rollback しない
class BodyFailure<E> {
  constructor(readonly failure: E) {}
}

// companyId を引数で受けず session から導く理由は docs/adr/0002-company-data-scoping.md (D3)
export const runScopedService = async <A, E extends TeamFailure>(
  session: RequestSession,
  body: () => Effect.Effect<
    A,
    E,
    LiveServices | Layer.Success<typeof RequestScoped> | ProvidedPerRequest
  >,
): Promise<Result.Result<A, E | DbUnavailable>> => {
  let result: Result.Result<A, E | DbUnavailable>;
  try {
    result = await withCompanyScope(db, session.companyId, async (tx) => {
      const bodyResult = await runtime
        .runPromise(
          Effect.result(
            Effect.suspend(body).pipe(
              Effect.provide(RequestScoped),
              Effect.provideService(Db, tx),
              Effect.provideService(CompanyContext, {
                companyId: session.companyId,
              }),
              Effect.provideService(AuthorizationContext, {
                userId: session.userId,
                role: session.role,
              }),
            ),
          ),
        )
        .catch((defect: unknown) => {
          throw new BodyDefect(defect);
        });
      if (Result.isFailure(bodyResult))
        throw new BodyFailure(bodyResult.failure);
      return bodyResult;
    });
  } catch (error) {
    if (error instanceof BodyDefect) throw error.defect;
    result =
      error instanceof BodyFailure
        ? Result.fail(error.failure)
        : Result.fail(new DbUnavailable({ cause: error }));
  }
  if (Result.isFailure(result)) reportUnexpectedFailure(result.failure);
  return result;
};
