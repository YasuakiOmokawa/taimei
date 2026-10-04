import { PgDialect, pgTable, varchar } from "drizzle-orm/pg-core";
import { expect, it } from "vitest";
import { companyFilter } from "../scoped";

const scopedRows = pgTable("scoped_rows", {
  companyId: varchar("company_id", { length: 32 }).notNull(),
});

it("companyFilter は company_id が渡した事業所と一致する行に絞る", () => {
  expect(
    new PgDialect().sqlToQuery(companyFilter(scopedRows, "cmp_a")),
  ).toMatchObject({
    sql: '"scoped_rows"."company_id" = $1',
    params: ["cmp_a"],
  });
});
