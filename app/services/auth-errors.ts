import { Data } from "effect";

export class MagicLinkError extends Data.TaggedError("MagicLinkError")<{
  cause: unknown;
}> {}

export class SessionError extends Data.TaggedError("SessionError")<{
  cause: unknown;
}> {}

export class AuthServiceError extends Data.TaggedError("AuthServiceError")<{
  message: string;
}> {}

export type AuthError = MagicLinkError | SessionError | AuthServiceError;
