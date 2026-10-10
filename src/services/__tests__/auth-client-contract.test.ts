import type {
  ListMembersResult,
  Member,
  SessionData,
} from "@taimei-code/auth-client";
import { expectTypeOf, it } from "vitest";

it("SDK SessionData の companyId は string か、事業所未選択の undefined である (ADR-0002 Phase 0)", () => {
  expectTypeOf<SessionData["companyId"]>().toEqualTypeOf<string | undefined>();
});

it("SDK SessionData の role は OWNER・ADMIN・MEMBER・undefined だけで、値が増えた版では型検査が落ちる", () => {
  expectTypeOf<SessionData["role"]>().toEqualTypeOf<
    "OWNER" | "ADMIN" | "MEMBER" | undefined
  >();
});

it("SDK Member は userId・name・email と、知らない値なら undefined になる role だけを持つ", () => {
  expectTypeOf<Member>().toEqualTypeOf<{
    userId: string;
    name: string;
    email: string;
    role?: "OWNER" | "ADMIN" | "MEMBER";
  }>();
});

it("SDK listMembers の成功は companyId と members だけを返す", () => {
  expectTypeOf<
    Extract<ListMembersResult, { ok: true }>["data"]
  >().toEqualTypeOf<{
    companyId?: string;
    members: readonly Member[];
  }>();
});
