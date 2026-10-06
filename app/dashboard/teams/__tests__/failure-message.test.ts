import { expect, it } from "vitest";
import { MemberListError } from "@/app/services/company-members-service";
import {
  DuplicateName,
  InvalidName,
  NotCompanyMember,
  NotManager,
  SkillNotFound,
  TeamNotFound,
  TeamServiceError,
} from "@/app/services/team-errors";
import { failureMessage } from "../failure-message";

it.each([
  [new NotManager(), "管理者だけが操作できます"],
  [new TeamNotFound({ teamId: "t" }), "チームが見つかりません"],
  [new SkillNotFound({ skillId: "s" }), "スキルが見つかりません"],
  [new NotCompanyMember({ userId: "u" }), "事業所のメンバーではありません"],
  [new MemberListError({ cause: 2 }), "メンバー一覧を取得できませんでした"],
  [new InvalidName(), "名前は 1〜50 文字で入力してください"],
  [new DuplicateName(), "同じ名前がすでにあります"],
  [new TeamServiceError({ cause: "db" }), "保存に失敗しました"],
])("%s の文言", (error, message) => {
  expect(failureMessage(error)).toBe(message);
});
