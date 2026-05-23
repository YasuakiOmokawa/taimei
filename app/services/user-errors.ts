import { Data } from "effect";

export class UserServiceError extends Data.TaggedError("UserServiceError")<{
  message: string;
}> {}
