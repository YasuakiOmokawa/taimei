import * as Sentry from "@sentry/nextjs";
import { Match } from "effect";
import type { TeamFailure } from "@/app/services/team-errors";
import { NAME_MAX_LENGTH } from "@/db/drizzle/schema";

type FailureHandling = {
  readonly message: string;
  readonly report: (() => void) | undefined;
};

const expectedFailure = (message: string): FailureHandling => ({
  message,
  report: undefined,
});

const unexpectedFailure = (
  message: string,
  report: () => void,
): FailureHandling => ({
  message,
  report,
});

const unexpectedDbFailure = ({ cause }: { readonly cause: unknown }) =>
  unexpectedFailure("保存に失敗しました", () => Sentry.captureException(cause));

const handlingOf = (failure: TeamFailure) =>
  Match.valueTags(failure, {
    NotManager: () => expectedFailure("管理者だけが操作できます"),
    TeamNotFound: () => expectedFailure("チームが見つかりません"),
    SkillNotFound: () => expectedFailure("スキルが見つかりません"),
    NotCompanyMember: () => expectedFailure("事業所のメンバーではありません"),
    InvalidName: () =>
      expectedFailure(`名前は 1〜${NAME_MAX_LENGTH} 文字で入力してください`),
    DuplicateName: () => expectedFailure("同じ名前がすでにあります"),
    NotAssigned: () =>
      expectedFailure("チームに割り当てられた人だけが記入できます"),
    InvalidLevel: () => expectedFailure("レベルの値が正しくありません"),
    MemberListError: ({ cause }) =>
      unexpectedFailure("メンバー一覧を取得できませんでした", () =>
        Sentry.captureMessage("listMembers failed", {
          level: "error",
          extra: { reason: cause },
        }),
      ),
    TeamServiceError: unexpectedDbFailure,
    DbUnavailable: unexpectedDbFailure,
  });

export const failureMessage = (failure: TeamFailure) =>
  handlingOf(failure).message;

export const reportUnexpectedFailure = (failure: TeamFailure) =>
  handlingOf(failure).report?.();

export type FailureMessage = string | null;
