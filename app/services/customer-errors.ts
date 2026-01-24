import { Data } from "effect";

export class CustomerServiceError extends Data.TaggedError(
  "CustomerServiceError"
)<{
  message: string;
}> {}
