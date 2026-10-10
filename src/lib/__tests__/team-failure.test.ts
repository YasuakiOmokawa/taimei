import { beforeEach, expect, it, vi } from "vitest";
import { MemberListError } from "@/src/services/company-members-service";
import { DbUnavailable } from "@/src/services/db-service";
import {
  DuplicateName,
  InvalidLevel,
  InvalidName,
  NotAssigned,
  NotCompanyMember,
  NotManager,
  SkillNotFound,
  type TeamFailure,
  TeamNotFound,
  TeamServiceError,
} from "@/src/services/team-errors";
import { failureMessage, reportUnexpectedFailure } from "../team-failure";

const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => vi.clearAllMocks());

type Reporting = "reported" | "notReported";

const handlingByTag = {
  NotManager: [new NotManager(), "管理者だけが操作できます", "notReported"],
  TeamNotFound: [
    new TeamNotFound({ teamId: "t" }),
    "チームが見つかりません",
    "notReported",
  ],
  SkillNotFound: [new SkillNotFound(), "スキルが見つかりません", "notReported"],
  NotCompanyMember: [
    new NotCompanyMember({ userId: "u" }),
    "事業所のメンバーではありません",
    "notReported",
  ],
  MemberListError: [
    new MemberListError({ cause: 2 }),
    "メンバー一覧を取得できませんでした",
    "reported",
  ],
  InvalidName: [
    new InvalidName(),
    "名前は 1〜50 文字で入力してください",
    "notReported",
  ],
  DuplicateName: [
    new DuplicateName(),
    "同じ名前がすでにあります",
    "notReported",
  ],
  NotAssigned: [
    new NotAssigned(),
    "チームに割り当てられた人だけが記入できます",
    "notReported",
  ],
  InvalidLevel: [
    new InvalidLevel(),
    "レベルの値が正しくありません",
    "notReported",
  ],
  TeamServiceError: [
    new TeamServiceError({ cause: "db" }),
    "保存に失敗しました",
    "reported",
  ],
  DbUnavailable: [
    new DbUnavailable({ cause: "db" }),
    "保存に失敗しました",
    "reported",
  ],
} satisfies Record<
  TeamFailure["_tag"],
  readonly [TeamFailure, string, Reporting]
>;

const handlings: readonly (readonly [TeamFailure, string, Reporting])[] =
  Object.values(handlingByTag);

it.each(handlings)("%s の文言", (failure, message) => {
  expect(failureMessage(failure)).toBe(message);
});

it.each(handlings.filter(([, , reporting]) => reporting === "reported"))(
  "予期しない失敗 %s は 1 回報告する",
  (failure) => {
    reportUnexpectedFailure(failure);

    expect(consoleError).toHaveBeenCalledOnce();
  },
);

it.each(handlings.filter(([, , reporting]) => reporting === "notReported"))(
  "利用者の操作で起きる失敗 %s は報告しない",
  (failure) => {
    reportUnexpectedFailure(failure);

    expect(consoleError).not.toHaveBeenCalled();
  },
);

const cause = new Error("connection refused");

it.each([new TeamServiceError({ cause }), new DbUnavailable({ cause })])(
  "DB の失敗 %s は原因の例外を報告する",
  (failure) => {
    reportUnexpectedFailure(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(cause);
  },
);

it("メンバー一覧の取得の失敗は、listMembers failed と reason で報告する", () => {
  reportUnexpectedFailure(new MemberListError({ cause: 2 }));

  expect(consoleError).toHaveBeenCalledExactlyOnceWith("listMembers failed", 2);
});
