import type { Role } from "@taimei-code/auth-client";
import { Effect, Result } from "effect";
import { describe, expect, it, vi } from "vitest";
import { resolveCompanyIdOrRedirect } from "@/app/lib/auth-guard";
import { runScopedService, runService } from "..";
import { AuthorizationContext } from "../authorization-context";
import { CompanyContext } from "../company-context";
import { Db } from "../db-service";

vi.mock("@/app/lib/auth-guard", () => ({
  resolveCompanyIdOrRedirect: vi.fn(),
}));

const resolveSession = ({ userId, role }: { userId: string; role?: Role }) =>
  vi.mocked(resolveCompanyIdOrRedirect).mockResolvedValue({
    companyId: "cmp_from_session",
    session: { user: { id: userId }, role },
  } as Awaited<ReturnType<typeof resolveCompanyIdOrRedirect>>);

describe("runScopedService", () => {
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

  it("事業所を導けず redirect するとき本体を実行しない", async () => {
    vi.mocked(resolveCompanyIdOrRedirect).mockRejectedValue(
      new Error("NEXT_REDIRECT"),
    );
    const body = vi.fn(() => Effect.void);

    await expect(runScopedService(body)).rejects.toThrow("NEXT_REDIRECT");
    expect(body).not.toHaveBeenCalled();
  });
});

describe("runService", () => {
  it("Live に結線した Db を本体に渡す", async () => {
    const result = await runService(() =>
      Effect.gen(function* () {
        const db = yield* Db;
        return typeof db.select;
      }),
    );

    expect(Result.getOrThrow(result)).toBe("function");
  });
});
