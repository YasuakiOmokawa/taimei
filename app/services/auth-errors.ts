import { Data } from "effect";

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  email: string;
}> {}

export class UserAlreadyExistsError extends Data.TaggedError(
  "UserAlreadyExistsError",
)<{
  email: string;
}> {}

export class MagicLinkError extends Data.TaggedError("MagicLinkError")<{
  cause: unknown;
}> {}

export class SessionError extends Data.TaggedError("SessionError")<{
  cause: unknown;
}> {}

export class SignOutError extends Data.TaggedError("SignOutError")<{
  cause: unknown;
}> {}

export class AuthServiceError extends Data.TaggedError("AuthServiceError")<{
  message: string;
}> {}

export type AuthError =
  | UserNotFoundError
  | UserAlreadyExistsError
  | MagicLinkError
  | SessionError
  | SignOutError
  | AuthServiceError;
