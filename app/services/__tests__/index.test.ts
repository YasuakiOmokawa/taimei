import type { Role } from "@taimei-code/auth-client";
import { eq } from "drizzle-orm";
import { Effect, Result } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCompanyIdOrRedirect } from "@/app/lib/auth-guard";
import { db } from "@/db/drizzle/client";
import { teams } from "@/db/drizzle/schema";
import { runScopedService } from "..";
import { AuthorizationContext } from "../authorization-context";
import { CompanyContext } from "../company-context";
import { Db, DbUnavailable } from "../db-service";
import { TeamService } from "../team-service";
import { currentCompanySetting } from "./db/test-db";

vi.mock("@/app/lib/auth-guard", () => ({
  resolveCompanyIdOrRedirect: vi.fn(),
}));

vi.mock("@/db/drizzle/client", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("@/db/drizzle/schema");
  const { TEST_DATABASE_URL } = await import("./db/global-setup");
  return { db: drizzle(TEST_DATABASE_URL, { schema }) };
});

const resolveSession = ({ userId, role }: { userId: string; role?: Role }) =>
  vi.mocked(resolveCompanyIdOrRedirect).mockResolvedValue({
    companyId: "cmp_from_session",
    session: { user: { id: userId }, role },
  } as Awaited<ReturnType<typeof resolveCompanyIdOrRedirect>>);

describe("runScopedService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("session の事業所を CompanyContext として本体に渡す", async () => {
    resolveSession({ userId: "u_1", role: "ADMIN" });

    const result = await runScopedService(() =>
      Effect.gen(function* () {
        const { companyId } = yield* CompanyContext;
        return companyId;
      }),
    );

    expect(Result.isSuccess(result)).toBe(true);
    expect(Result.getOrThrow(result)).toBe("cmp_from_session");
  });

  it("session の user id と role を AuthorizationContext として本体に渡す", async () => {
    resolveSession({ userId: "u_1", role: "ADMIN" });

    const result = await runScopedService(() =>
      Effect.gen(function* () {
        return yield* AuthorizationContext;
      }),
    );

    expect(Result.getOrThrow(result)).toEqual({ userId: "u_1", role: "ADMIN" });
  });

  it("SDK が role を返さない session では role を undefined のまま渡す", async () => {
    resolveSession({ userId: "u_1" });

    const result = await runScopedService(() =>
      Effect.gen(function* () {
        return yield* AuthorizationContext;
      }),
    );

    expect(Result.getOrThrow(result).role).toBeUndefined();
  });

  it("本体の Db は、session の事業所を app.company_id に設定した transaction", async () => {
    resolveSession({ userId: "u_1", role: "ADMIN" });
    const transaction = vi.spyOn(db, "transaction");

    const result = await runScopedService(() =>
      Effect.gen(function* () {
        const scoped = yield* Db;
        return yield* Effect.promise(() => currentCompanySetting(scoped));
      }),
    );

    expect(Result.getOrThrow(result)).toBe("cmp_from_session");
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("本体の TeamService は、本体の Db と同じ transaction で読む", async () => {
    resolveSession({ userId: "u_1", role: "ADMIN" });

    const result = await runScopedService(() =>
      Effect.gen(function* () {
        const db = yield* Db;
        const [team] = yield* Effect.promise(() =>
          db
            .insert(teams)
            .values({
              companyId: "cmp_from_session",
              name: "未 commit のチーム",
            })
            .returning(),
        );
        const listed = yield* TeamService.use((service) =>
          service.listTeams(),
        ).pipe(
          Effect.ensuring(
            Effect.promise(() => db.delete(teams).where(eq(teams.id, team.id))),
          ),
        );
        return listed.map(({ name }) => name);
      }),
    );

    expect(Result.getOrThrow(result)).toEqual(["未 commit のチーム"]);
  });

  it("transaction を開けない時は、reject せず DbUnavailable の失敗を返す", async () => {
    resolveSession({ userId: "u_1", role: "ADMIN" });
    const cause = new Error("connection refused");
    vi.spyOn(db, "transaction").mockRejectedValue(cause);

    const result = await runScopedService(() => Effect.succeed("unreachable"));

    expect(result).toEqual(Result.fail(new DbUnavailable({ cause })));
  });

  it("本体の defect は今までどおり reject する", async () => {
    resolveSession({ userId: "u_1", role: "ADMIN" });
    const defect = new Error("bug");

    await expect(runScopedService(() => Effect.die(defect))).rejects.toBe(
      defect,
    );
  });

  it("事業所を導けず redirect するとき本体を実行しない", async () => {
    vi.mocked(resolveCompanyIdOrRedirect).mockRejectedValue(
      new Error("NEXT_REDIRECT"),
    );
    const body = vi.fn(() => Effect.void);
    const transaction = vi.spyOn(db, "transaction");

    await expect(runScopedService(body)).rejects.toThrow("NEXT_REDIRECT");
    expect(body).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
