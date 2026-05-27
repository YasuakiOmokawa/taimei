import { Data } from "effect";

export class InvoiceNotFound extends Data.TaggedError("InvoiceNotFound")<{
  id: string;
}> {}

export class InvoiceServiceError extends Data.TaggedError(
  "InvoiceServiceError",
)<{
  message: string;
}> {}

// invoice の作成/更新で指定された customerId が自社スコープ外だった場合に投げる。
// InvoiceNotFound (invoice 不在) と区別し、呼出側が顧客向け文言を出せるようにする。
export class CustomerNotInScope extends Data.TaggedError("CustomerNotInScope")<{
  customerId: string;
}> {}
