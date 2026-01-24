import { Data } from "effect";

export class Tag2NotFound extends Data.TaggedError("Tag2NotFound")<{
  id: string;
}> {}

export class Tag2ParseError extends Data.TaggedError("Tag2ParseError")<{
  message: string;
}> {}

export class Tag2ServiceError extends Data.TaggedError("Tag2ServiceError")<{
  message: string;
}> {}
