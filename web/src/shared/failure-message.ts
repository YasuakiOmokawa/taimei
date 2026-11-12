import { Cause, Option } from "effect";
import { NAME_MAX_LENGTH } from "../../../db/column-values";
import type {
  OperationFailure,
  SessionChanged,
  Unauthenticated,
} from "../../../src/spa-contract";

type ShownFailure = OperationFailure | Unauthenticated | SessionChanged;

const FAILURE_MESSAGES: {
  readonly [Tag in OperationFailure["_tag"]]: string;
} = {
  NotManager: "管理者だけが操作できます",
  TeamNotFound: "チームが見つかりません",
  SkillNotFound: "スキルが見つかりません",
  NotCompanyMember: "事業所のメンバーではありません",
  InvalidName: `名前は 1〜${NAME_MAX_LENGTH} 文字で入力してください`,
  DuplicateName: "同じ名前がすでにあります",
  NotAssigned: "チームに割り当てられた人だけが記入できます",
  InvalidLevel: "レベルの値が正しくありません",
};

export const failureMessageOf = (
  cause: Cause.Cause<ShownFailure>,
  fallbackMessage: string,
): string => {
  const messagesByTag: { readonly [tag: string]: string | undefined } =
    FAILURE_MESSAGES;
  return Option.match(Cause.findErrorOption(cause), {
    onNone: () => fallbackMessage,
    onSome: (failure) => messagesByTag[failure._tag] ?? fallbackMessage,
  });
};
