import {
  foreignKey,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const NAME_MAX_LENGTH = 50;

// taimei-auth の company.id (cmp_<nanoid24>) への論理参照。cross-DB のため FK は張らない (docs/adr/0002-company-data-scoping.md)。
const companyId = () => varchar("company_id", { length: 32 }).notNull();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const teams = pgTable(
  "teams",
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: companyId(),
    name: varchar({ length: NAME_MAX_LENGTH }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique().on(table.id, table.companyId),
    unique().on(table.companyId, table.name),
  ],
);

export const skills = pgTable(
  "skills",
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: companyId(),
    teamId: uuid("team_id").notNull(),
    name: varchar({ length: NAME_MAX_LENGTH }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique().on(table.teamId, table.name),
    foreignKey({
      columns: [table.teamId, table.companyId],
      foreignColumns: [teams.id, teams.companyId],
    }).onDelete("cascade"),
  ],
);

export const teamAssignments = pgTable(
  "team_assignments",
  {
    companyId: companyId(),
    teamId: uuid("team_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    foreignKey({
      columns: [table.teamId, table.companyId],
      foreignColumns: [teams.id, teams.companyId],
    }).onDelete("cascade"),
  ],
);
