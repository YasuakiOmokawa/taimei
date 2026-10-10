import { eq } from "drizzle-orm";
import { Effect, Result } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teams } from "@/db/drizzle/schema";
import { CompanyId } from "@/db/ids";
import { type RequestSession, runScopedService } from "..";
import { AuthorizationContext } from "../authorization-context";
import { CompanyContext } from "../company-context";
import { Db, DbUnavailable } from "../db-service";
import { TeamNotFound, TeamServiceError } from "../team-errors";
import { TeamService } from "../team-service";
import {
  currentCompanySetting,
  type TestDb,
  withRollbackDb,
} from "./db/test-db";

vi.mock("@/db/drizzle/client", async () => ({
  db: (await import("./db/test-db")).dbInRollback,
}));

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const companyId = CompanyId.make("cmp_from_session");
const session: RequestSession = {
  companyId,
  userId: "u_1",
  userName: "山田 花子",
  role: "ADMIN",
};

const teamsNamed = (tx: TestDb, name: string) =>
  tx.select().from(teams).where(eq(teams.name, name));

const insertTeam = (name: string) =>
  Db.use((scoped) =>
    Effect.promise(() => scoped.insert(teams).values({ companyId, name })),
  );

describe("runScopedService", () => {
  it("session の事業所を CompanyContext として本体に渡す", () =>
    withRollbackDb(async () => {
      const result = await runScopedService(session, () =>
        CompanyContext.use(({ companyId }) => Effect.succeed(companyId)),
      );

      expect(Result.getOrThrow(result)).toBe("cmp_from_session");
    }));

  it("session の user id と role を AuthorizationContext として本体に渡す", () =>
    withRollbackDb(async () => {
      const result = await runScopedService(session, () =>
        AuthorizationContext.use(Effect.succeed),
      );

      expect(Result.getOrThrow(result)).toEqual({
        userId: "u_1",
        role: "ADMIN",
      });
    }));

  it("本体の Db は、session の事業所を app.company_id に設定した transaction", () =>
    withRollbackDb(async () => {
      const result = await runScopedService(session, () =>
        Db.use((scoped) => Effect.promise(() => currentCompanySetting(scoped))),
      );

      expect(Result.getOrThrow(result)).toBe("cmp_from_session");
    }));

  it("本体の TeamService は、本体の Db と同じ transaction で読む", () =>
    withRollbackDb(async () => {
      const result = await runScopedService(session, () =>
        insertTeam("未 commit のチーム").pipe(
          Effect.andThen(TeamService.use((service) => service.listTeams)),
        ),
      );

      expect(Result.getOrThrow(result).map((team) => team.name)).toEqual([
        "未 commit のチーム",
      ]);
    }));

  it("本体が書いた後に失敗すると、その失敗を返し、書いた行を戻す", () =>
    withRollbackDb(async (tx) => {
      const failure = new TeamNotFound({ teamId: "t" });

      const result = await runScopedService(session, () =>
        insertTeam("失敗で戻るチーム").pipe(
          Effect.andThen(Effect.fail(failure)),
        ),
      );

      expect(result).toEqual(Result.fail(failure));
      expect(await teamsNamed(tx, "失敗で戻るチーム")).toEqual([]);
    }));

  it("本体が書いて成功すると、書いた行が残る", () =>
    withRollbackDb(async (tx) => {
      const result = await runScopedService(session, () =>
        insertTeam("成功で残るチーム"),
      );

      expect(Result.isSuccess(result)).toBe(true);
      expect(await teamsNamed(tx, "成功で残るチーム")).toHaveLength(1);
    }));

  it("transaction を開けない時は、reject せず DbUnavailable の失敗を返し、原因を 1 回報告する", () =>
    withRollbackDb(async (tx) => {
      const cause = new Error("connection refused");
      vi.spyOn(tx, "transaction").mockRejectedValue(cause);

      const result = await runScopedService(session, () =>
        Effect.succeed("unreachable"),
      );

      expect(result).toEqual(Result.fail(new DbUnavailable({ cause })));
      expect(consoleError).toHaveBeenCalledExactlyOnceWith(cause);
    }));

  it("本体の defect は reject し、DbUnavailable にしない", () =>
    withRollbackDb(async () => {
      const defect = new Error("bug");

      await expect(
        runScopedService(session, () => Effect.die(defect)),
      ).rejects.toBe(defect);
    }));

  it("Effect を返す前に投げた本体の例外は reject し、DbUnavailable にしない", () =>
    withRollbackDb(async () => {
      const bug = new TypeError("bug");

      await expect(
        runScopedService(session, () => {
          throw bug;
        }),
      ).rejects.toBe(bug);
    }));

  it("利用者の操作で起きる失敗は報告しない", () =>
    withRollbackDb(async () => {
      const result = await runScopedService(session, () =>
        Effect.fail(new TeamNotFound({ teamId: "t" })),
      );

      expect(Result.isFailure(result)).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
    }));

  it("本体の予期しない失敗は、その失敗を返し、原因を 1 回報告する", () =>
    withRollbackDb(async () => {
      const cause = new Error("query failed");

      const result = await runScopedService(session, () =>
        Effect.fail(new TeamServiceError({ cause })),
      );

      expect(result).toEqual(Result.fail(new TeamServiceError({ cause })));
      expect(consoleError).toHaveBeenCalledExactlyOnceWith(cause);
    }));
});
