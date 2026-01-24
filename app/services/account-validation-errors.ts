import { Data } from "effect";

export class AccountAlreadyExists extends Data.TaggedError(
  "AccountAlreadyExists"
)<{
  message: string;
}> {}
