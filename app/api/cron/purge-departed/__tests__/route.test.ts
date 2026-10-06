// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { purgeDeparted } from "@/app/lib/purge-departed";
import { GET } from "../route";

vi.mock("@/app/lib/purge-departed", () => ({ purgeDeparted: vi.fn() }));

const report = {
  deletedCompanyIds: ["cmp_gone"],
  removedAssignments: 2,
  skippedCompanyIds: [],
};

const call = (authorization?: string) =>
  GET(
    new Request("http://app.example.com/api/cron/purge-departed", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("GET /api/cron/purge-departed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(purgeDeparted).mockReset();
  });

  it("CRON_SECRET と一致する Bearer なら照合を流し、結果を JSON で返す", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.mocked(purgeDeparted).mockResolvedValue(report);

    const response = await call("Bearer s3cret");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(report);
    expect(purgeDeparted).toHaveBeenCalledOnce();
  });

  it("Bearer が一致しなければ 401 で、照合を流さない", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");

    const response = await call("Bearer wrong");

    expect(response.status).toBe(401);
    expect(purgeDeparted).not.toHaveBeenCalled();
  });

  it("CRON_SECRET が無ければ 503 で、照合を流さない", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await call("Bearer ");

    expect(response.status).toBe(503);
    expect(purgeDeparted).not.toHaveBeenCalled();
  });
});
