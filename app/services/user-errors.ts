import { Data } from "effect";

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  id: string;
}> {}

export class UserServiceError extends Data.TaggedError("UserServiceError")<{
  message: string;
}> {}
