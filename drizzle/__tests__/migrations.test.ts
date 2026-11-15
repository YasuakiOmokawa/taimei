import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "..");

const APPLIED_BEFORE_711 = "#711 の前に本番に適用済み";

const STATEMENTS_ALLOWED_WITH_REASON: Readonly<
  Record<
    string,
    { readonly reason: string; readonly statements: readonly string[] }
  >
> = {
  "0002_new_lockjaw.sql": {
    reason: APPLIED_BEFORE_711,
    statements: ['DROP TABLE IF EXISTS "user_profile"'],
  },
  "0006_drop_legacy_tables.sql": {
    reason: APPLIED_BEFORE_711,
    statements: [
      'DROP TABLE "_invoicesTotags"',
      'DROP TABLE "invoices"',
      'DROP TABLE "customers"',
      'DROP TABLE "tags"',
      'DROP TABLE "tags2"',
      'DROP TABLE "revenue"',
    ],
  },
  "0011_drop_legacy_auth_tables.sql": {
    reason: APPLIED_BEFORE_711,
    statements: [
      'DROP TABLE IF EXISTS "session"',
      'DROP TABLE IF EXISTS "account"',
      'DROP TABLE IF EXISTS "user"',
      'DROP TABLE IF EXISTS "verification"',
      'DROP TABLE IF EXISTS "Session"',
      'DROP TABLE IF EXISTS "Account"',
      'DROP TABLE IF EXISTS "Authenticator"',
      'DROP TABLE IF EXISTS "UserProfile"',
      'DROP TABLE IF EXISTS "User"',
      'DROP TABLE IF EXISTS "VerificationToken"',
      'DROP TABLE IF EXISTS "_prisma_migrations"',
    ],
  },
};

const DELETES_ROWS_OR_COLUMNS =
  /\b(DROP\s+(TABLE|COLUMN|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b|\bDROP\b[\s\S]*\bCASCADE\b/i;
const BREAKS_RUNNING_WORKER = /\bDROP\s+FUNCTION\b|\bRENAME\b/i;
const ALTERS_TABLE = /\bALTER\s+TABLE\b/i;
const COMMA_OUTSIDE_PARENTHESES = /,(?![^()]*\))/;
const ADDS_COLUMN =
  /\bADD\s+(?:COLUMN\s+)?(?!(?:CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE)\b)/i;
const NOT_NULL = /\bNOT\s+NULL\b/i;
const HAS_DEFAULT = /\bDEFAULT\b/i;

const addsRequiredColumnWithoutDefault = (statement: string) =>
  ALTERS_TABLE.test(statement) &&
  statement
    .split(COMMA_OUTSIDE_PARENTHESES)
    .some(
      (action) =>
        ADDS_COLUMN.test(action) &&
        NOT_NULL.test(action) &&
        !HAS_DEFAULT.test(action),
    );

const needsReason = (statement: string) =>
  DELETES_ROWS_OR_COLUMNS.test(statement) ||
  BREAKS_RUNNING_WORKER.test(statement) ||
  addsRequiredColumnWithoutDefault(statement);

const SQL_COMMENTS = /--(?!>).*$/gm;
const STATEMENT_END = /-->\s*statement-breakpoint|;/;

const statementsNeedingReasonOf = (file: string) =>
  readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
    .replace(SQL_COMMENTS, "")
    .split(STATEMENT_END)
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(needsReason);

it("行や列を消す文 (DROP TABLE・DROP COLUMN・DROP SCHEMA・TRUNCATE・DELETE FROM・CASCADE 付きの DROP) と、動いている Worker を壊す文 (DROP FUNCTION・RENAME・既定値の無い NOT NULL の ADD COLUMN) を持つ migration は、STATEMENTS_ALLOWED_WITH_REASON に理由を付けて載せる (main に入ると staging と本番に承認なしで適用され、deploy が終わるまで前の版の Worker が新しい DB を呼ぶ。前の版の Worker が使う関数・表・列を壊す時は、新しい名前を足す migration と古い名前を消す migration を別の deploy に分ける)", () => {
  const found = Object.fromEntries(
    readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [file, statementsNeedingReasonOf(file)] as const)
      .filter(([, statements]) => statements.length > 0),
  );

  expect(found).toEqual(
    Object.fromEntries(
      Object.entries(STATEMENTS_ALLOWED_WITH_REASON).map(
        ([file, { statements }]) => [file, statements],
      ),
    ),
  );
  expect(
    Object.entries(STATEMENTS_ALLOWED_WITH_REASON)
      .filter(([, { reason }]) => reason.trim() === "")
      .map(([file]) => file),
  ).toEqual([]);
});
