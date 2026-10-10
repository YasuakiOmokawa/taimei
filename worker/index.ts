import { Effect, Option, Result, Schema } from "effect";
import type { Pool } from "pg";
import { AuthorizationContext } from "@/app/services/authorization-context";
import { CompanyContext } from "@/app/services/company-context";
import { Db } from "@/app/services/db-service";
import { TeamService } from "@/app/services/team-service";
import { runWithRequestPool } from "@/db/drizzle/client";
import { CompanyId } from "@/db/ids";

type Env = {
  HYPERDRIVE: { connectionString: string };
  PROTOTYPE_SECRET?: string;
};

const countStatements = (pool: Pool) => {
  let statements = 0;
  pool.on("connect", (client) => {
    const query = client.query.bind(client);
    client.query = ((...args: Parameters<typeof query>) => {
      statements++;
      return query(...args);
    }) as typeof client.query;
  });
  return () => statements;
};

const Session = Schema.Struct({
  companyId: CompanyId,
  userId: Schema.String,
  role: Schema.optional(Schema.Literals(["OWNER", "ADMIN", "MEMBER"])),
});
const decodeSession = Schema.decodeUnknownOption(Session);

// ponytail: taimei-auth の session の検証は PoC と同じく外し、秘密を知る呼び手の header を検証済みの session として扱う。Service Binding で置き換える
const sessionOf = (request: Request, env: Env) => {
  const secret = env.PROTOTYPE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return undefined;
  return Option.getOrUndefined(
    decodeSession({
      companyId: request.headers.get("x-company-id"),
      userId: request.headers.get("x-user-id"),
      role: request.headers.get("x-role") ?? undefined,
    }),
  );
};

const getTeamInScope = (session: typeof Session.Type, teamId: string) =>
  Db.inCompanyScope(session.companyId, (tx) =>
    Effect.runPromise(
      Effect.result(
        TeamService.use((teams) => teams.getTeam(teamId)).pipe(
          Effect.provide(TeamService.layer),
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
    ),
  );

const toResponse = ({
  result,
  statements,
}: {
  result: Awaited<ReturnType<typeof getTeamInScope>>;
  statements: number;
}) => {
  const headers = { "x-statements": String(statements) };
  if (Result.isSuccess(result))
    return Response.json(result.success, { headers });
  return Response.json(
    { _tag: result.failure._tag },
    { status: result.failure._tag === "TeamNotFound" ? 404 : 500, headers },
  );
};

const worker = {
  async fetch(request: Request, env: Env) {
    const teamId = new URL(request.url).pathname.match(
      /^\/api\/teams\/([^/]+)$/,
    )?.[1];
    if (!teamId) return new Response(null, { status: 404 });
    const session = sessionOf(request, env);
    if (!session) return new Response(null, { status: 401 });
    // Hyperdrive が pool を持つので、Worker の Pool は request ごとに作って閉じる
    return runWithRequestPool(env.HYPERDRIVE.connectionString, async (pool) => {
      const statements = countStatements(pool);
      try {
        const result = await getTeamInScope(session, teamId);
        return toResponse({ result, statements: statements() });
      } finally {
        await pool.end();
      }
    });
  },
};

export default worker;
