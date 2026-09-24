import { Data } from "effect";

export class SessionError extends Data.TaggedError("SessionError")<{
  cause: unknown;
}> {}
