import type { TeamFailure } from "@/app/services/team-errors";
import { NAME_MAX_LENGTH } from "@/db/drizzle/schema";

const messages: Record<TeamFailure["_tag"], string> = {
  NotManager: "管理者だけが操作できます",
  TeamNotFound: "チームが見つかりません",
  SkillNotFound: "スキルが見つかりません",
  NotCompanyMember: "事業所のメンバーではありません",
  MemberListError: "メンバー一覧を取得できませんでした",
  InvalidName: `名前は 1〜${NAME_MAX_LENGTH} 文字で入力してください`,
  DuplicateName: "同じ名前がすでにあります",
  TeamServiceError: "保存に失敗しました",
};

export const failureMessage = (failure: TeamFailure) => messages[failure._tag];

export type FailureMessage = string | null;
