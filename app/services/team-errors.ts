import { Data } from "effect";
import type { MemberListError } from "./company-members-service";

export class TeamNotFound extends Data.TaggedError("TeamNotFound")<{
  teamId: string;
}> {}

export class SkillNotFound extends Data.TaggedError("SkillNotFound")<{
  skillId: string;
}> {}

export class NotManager extends Data.TaggedError("NotManager") {}

export class NotCompanyMember extends Data.TaggedError("NotCompanyMember")<{
  userId: string;
}> {}

export class InvalidName extends Data.TaggedError("InvalidName") {}

export class DuplicateName extends Data.TaggedError("DuplicateName") {}

export class TeamServiceError extends Data.TaggedError("TeamServiceError")<{
  cause: unknown;
}> {}

export type TeamFailure =
  | NotManager
  | TeamNotFound
  | SkillNotFound
  | NotCompanyMember
  | MemberListError
  | InvalidName
  | DuplicateName
  | TeamServiceError;
