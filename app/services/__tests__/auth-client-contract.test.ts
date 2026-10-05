// auth-guard 経由で import すると server-only と ConnectRPC client の初期化が走るので、SDK の型だけを import する。
import type { SessionData } from "@taimei-code/auth-client";
import { expectTypeOf, it } from "vitest";

it("SDK SessionData の companyId は string か、事業所未選択の undefined である (ADR-0002 Phase 0)", () => {
  expectTypeOf<SessionData["companyId"]>().toEqualTypeOf<string | undefined>();
});

it("SDK SessionData の role は OWNER・ADMIN・MEMBER・undefined だけで、値が増えた版では型検査が落ちる", () => {
  expectTypeOf<SessionData["role"]>().toEqualTypeOf<
    "OWNER" | "ADMIN" | "MEMBER" | undefined
  >();
});
