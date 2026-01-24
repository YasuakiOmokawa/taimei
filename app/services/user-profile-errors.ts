import { Data } from "effect";

export class UserProfileNotFound extends Data.TaggedError(
  "UserProfileNotFound"
)<{
  userId: string;
}> {}

export class UserProfileServiceError extends Data.TaggedError(
  "UserProfileServiceError"
)<{
  message: string;
}> {}
