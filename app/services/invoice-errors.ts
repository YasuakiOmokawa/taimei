import { Data } from "effect";

export class InvoiceNotFound extends Data.TaggedError("InvoiceNotFound")<{
  id: string;
}> {}

export class InvoiceServiceError extends Data.TaggedError(
  "InvoiceServiceError",
)<{
  message: string;
}> {}
