// 型のみ import。auth-guard 経由だと server-only / ConnectRPC client の
// module 初期化が走るため、contract 検証は SDK の型契約に限定する。
import type { SessionData } from "@taimei-code/auth-client";
import { expectTypeOf, it } from "vitest";

// SDK と本体の境界契約。設計詳細: docs/adr/0002-company-data-scoping.md (Phase 0)。
// scoping 機構 (PR-2 以降) は getSession().companyId を唯一の company source とするため、
// SDK 退行で companyId が消えると本体の全 scoped query が静かに company 不定になる。
// 型 assertion を CI 常時 (lint.yml の bun tsc --noEmit) で効かせ、退行を PR でブロックする。
it("SDK SessionData が companyId を提供する (ADR-0002 Phase 0 contract)", () => {
  expectTypeOf<SessionData>().toHaveProperty("companyId");
  // 事業所未選択 user では companyId 不在のため optional。
  // 未選択判定 (PR-2 resolveCompanyIdOrRedirect) はこの undefined を見て redirect する。
  expectTypeOf<SessionData["companyId"]>().toEqualTypeOf<string | undefined>();
});
