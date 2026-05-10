import { Data } from "effect";

// 動的 import("next/headers") が Server Component / Server Action 文脈外で呼ばれた場合の throw を捕捉する。
// Effect.promise は never-fail 前提で throw を Defect 化するため、effect-patterns.md「try-catch 禁止 /
// TaggedError._tag で分岐」原則に従い Effect.tryPromise + TaggedError 必須。
export class CookieReadError extends Data.TaggedError("CookieReadError")<{
  cause: unknown;
}> {}
