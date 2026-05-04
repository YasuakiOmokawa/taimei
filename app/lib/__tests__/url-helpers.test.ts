import { describe, it, expect, vi, beforeEach } from "vitest";
import { headers } from "next/headers";
import { buildAbsoluteCallbackURL } from "../url-helpers";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

describe("buildAbsoluteCallbackURL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("host ヘッダから絶対 URL を組み立てる", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: (name: string) => (name === "host" ? "localhost:3000" : null),
    } as any);

    expect(await buildAbsoluteCallbackURL("/dashboard")).toBe(
      "http://localhost:3000/dashboard"
    );
  });

  it("x-forwarded-proto が https なら https を採用する（プロキシ環境）", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: (name: string) => {
        if (name === "host") return "app.taimei-code.com";
        if (name === "x-forwarded-proto") return "https";
        return null;
      },
    } as any);

    expect(await buildAbsoluteCallbackURL("/dashboard")).toBe(
      "https://app.taimei-code.com/dashboard"
    );
  });

  it("host が無い場合は localhost:3000 にフォールバック", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: () => null,
    } as any);

    expect(await buildAbsoluteCallbackURL("/foo")).toBe(
      "http://localhost:3000/foo"
    );
  });
});
