import { Effect, Result } from "effect";
import { describe, expect, it, vi } from "vitest";
import { resolveCompanyIdOrRedirect } from "@/app/lib/auth-guard";
import { runScopedService, runService } from "..";
import { CompanyContext } from "../company-context";
import { Db } from "../db-service";

vi.mock("@/app/lib/auth-guard", () => ({
  resolveCompanyIdOrRedirect: vi.fn(),
}));

describe("runScopedService", () => {
  it("session の事業所を CompanyContext として本体に渡す", async () => {
    vi.mocked(resolveCompanyIdOrRedirect).mockResolvedValue({
      companyId: "cmp_from_session",
    } as Awaited<ReturnType<typeof resolveCompanyIdOrRedirect>>);

    const result = await runScopedService(() =>
      Effect.gen(function* () {
        const { companyId } = yield* CompanyContext;
        return companyId;
      }),
    );

    expect(Result.isSuccess(result)).toBe(true);
    expect(Result.getOrThrow(result)).toBe("cmp_from_session");
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
