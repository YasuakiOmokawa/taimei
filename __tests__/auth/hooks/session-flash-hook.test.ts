import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isJustSignedUp } from "@/lib/auth/hooks/session-flash-hook";

describe("isJustSignedUp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("10秒以内に作成されたユーザーは true", () => {
    const createdAt = new Date("2023-12-31T23:59:55.000Z");
    expect(isJustSignedUp(createdAt)).toBe(true);
  });

  it("10秒以上前に作成されたユーザーは false", () => {
    const createdAt = new Date("2023-12-31T23:59:50.000Z");
    expect(isJustSignedUp(createdAt)).toBe(false);
  });
});
