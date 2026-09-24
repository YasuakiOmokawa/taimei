import { Data } from "effect";

// next/headers は Server Component / Server Action の外で呼ぶと throw し、Effect.promise では Defect になる。
export class CookieReadError extends Data.TaggedError("CookieReadError")<{
  cause: unknown;
}> {}
