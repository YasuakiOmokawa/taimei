import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

// company_id を持つテーブルの scoping 条件の唯一の入口 (SSOT)。
// 設計詳細: docs/adr/0002-company-data-scoping.md (D4)。
//
// 生の eq(table.companyId, ...) を Service に直書きせず必ずこの helper を通す。
// これにより「scoped テーブルへの companyFilter 無しアクセス」を grep / review / lint で
// 機械的に探せる (CompanyContext 方式は WHERE 付け忘れが型で防げない fail-open のため)。
type ScopedTable = { companyId: PgColumn };

export const companyFilter = <T extends ScopedTable>(
  table: T,
  companyId: string,
) => eq(table.companyId, companyId);
