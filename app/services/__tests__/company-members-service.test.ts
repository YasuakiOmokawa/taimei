import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect, vi } from "vitest";
import { listMembers } from "@/app/lib/auth-guard";
import { CompanyMembers } from "../company-members-service";

vi.mock("@/app/lib/auth-guard", () => ({ listMembers: vi.fn() }));

const members = [
  { userId: "u_1", name: "A", email: "a@example.com", role: "OWNER" as const },
];

it.effect("SDK の一覧が取れればメンバーを返す", () =>
  Effect.gen(function* () {
    vi.mocked(listMembers).mockResolvedValue({
      ok: true,
      data: { companyId: "cmp_a", members },
    });
    const { list } = yield* CompanyMembers;
    expect(yield* list).toEqual(members);
  }).pipe(Effect.provide(CompanyMembers.layer)),
);

it.effect("SDK の一覧が失敗すれば MemberListError で失敗する", () =>
  Effect.gen(function* () {
    vi.mocked(listMembers).mockResolvedValue({ ok: false, reason: 2 });
    const { list } = yield* CompanyMembers;
    const error = yield* Effect.flip(list);
    expect(error._tag).toBe("MemberListError");
  }).pipe(Effect.provide(CompanyMembers.layer)),
);
