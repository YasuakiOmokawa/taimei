import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "..");

const APPLIED_BEFORE_711 = "#711 の前に本番に適用済み";

const ALLOWED_DESTRUCTIVE_STATEMENTS: Readonly<
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

const DESTRUCTIVE =
  /\b(DROP\s+(TABLE|COLUMN|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b|\bDROP\b[\s\S]*\bCASCADE\b/i;
const SQL_COMMENTS = /--(?!>).*$/gm;
const STATEMENT_END = /-->\s*statement-breakpoint|;/;

const destructiveStatementsOf = (file: string) =>
  readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
    .replace(SQL_COMMENTS, "")
    .split(STATEMENT_END)
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter((statement) => DESTRUCTIVE.test(statement));

it("行や列を消す文 (DROP TABLE・DROP COLUMN・DROP SCHEMA・TRUNCATE・DELETE FROM・CASCADE 付きの DROP) を持つ migration は、意図した削除なら ALLOWED_DESTRUCTIVE_STATEMENTS に理由を付けて載せる (main に入ると staging と本番に承認なしで適用される)", () => {
  const found = Object.fromEntries(
    readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [file, destructiveStatementsOf(file)] as const)
      .filter(([, statements]) => statements.length > 0),
  );

  expect(found).toEqual(
    Object.fromEntries(
      Object.entries(ALLOWED_DESTRUCTIVE_STATEMENTS).map(
        ([file, { statements }]) => [file, statements],
      ),
    ),
  );
  expect(
    Object.entries(ALLOWED_DESTRUCTIVE_STATEMENTS)
      .filter(([, { reason }]) => reason.trim() === "")
      .map(([file]) => file),
  ).toEqual([]);
});
