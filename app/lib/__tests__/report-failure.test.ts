import * as Sentry from "@sentry/nextjs";
import { beforeEach, expect, it, vi } from "vitest";
import { MemberListError } from "@/app/services/company-members-service";
import {
  DuplicateName,
  InvalidLevel,
  NotAssigned,
  NotManager,
  TeamNotFound,
  TeamServiceError,
} from "@/app/services/team-errors";
import { reportUnexpectedFailure } from "../report-failure";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

it("DB の失敗は原因の例外を Sentry に送る", () => {
  const cause = new Error("connection refused");

  reportUnexpectedFailure(new TeamServiceError({ cause }));

  expect(Sentry.captureException).toHaveBeenCalledWith(cause);
});

it("メンバー一覧の取得の失敗は、/dashboard/members と同じ文言と reason で送る", () => {
  reportUnexpectedFailure(new MemberListError({ cause: 2 }));

  expect(Sentry.captureMessage).toHaveBeenCalledWith("listMembers failed", {
    level: "error",
    extra: { reason: 2 },
  });
});

it.each([
  new NotManager(),
  new TeamNotFound({ teamId: "t" }),
  new DuplicateName(),
  new NotAssigned(),
  new InvalidLevel(),
])("利用者の操作で起きる失敗 %s は送らない", (failure) => {
  reportUnexpectedFailure(failure);

  expect(Sentry.captureException).not.toHaveBeenCalled();
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
});
