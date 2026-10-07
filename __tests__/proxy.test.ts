// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy from "@/proxy";

const requestWithoutCookie = (path: string) =>
  proxy(new NextRequest(`http://app.example.com${path}`));

const isPassedThrough = (response: Response) =>
  response.headers.get("x-middleware-next") === "1" &&
  response.headers.get("location") === null;

describe("proxy (cookie なし)", () => {
  it("/privacy は taimei-auth へ送らずに通す", async () => {
    expect(isPassedThrough(await requestWithoutCookie("/privacy"))).toBe(true);
  });

  it("/privacy の子 path は taimei-auth へ送る", async () => {
    expect(isPassedThrough(await requestWithoutCookie("/privacy/x"))).toBe(
      false,
    );
  });

  it("/auth/after-signin は今までどおり通し、/dashboard は taimei-auth へ送る", async () => {
    expect(
      isPassedThrough(await requestWithoutCookie("/auth/after-signin")),
    ).toBe(true);
    expect(isPassedThrough(await requestWithoutCookie("/dashboard"))).toBe(
      false,
    );
  });

  it("照合の route は cookie なしで通す", async () => {
    expect(
      isPassedThrough(await requestWithoutCookie("/api/cron/purge-departed")),
    ).toBe(true);
  });
});
