import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { CompanyContext } from "../company-context";

it.effect("CompanyContext から注入した companyId を読める", () =>
  Effect.gen(function* () {
    const { companyId } = yield* CompanyContext;
    expect(companyId).toBe("cmp_zzz");
  }).pipe(Effect.provide(CompanyContext.layer({ companyId: "cmp_zzz" }))),
);
