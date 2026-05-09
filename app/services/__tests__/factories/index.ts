import { composeFactory, defineFactory } from "@praha/drizzle-factory";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userProfile } from "@/db/drizzle/schema";

// user テーブルは auth-service DB に移動済みだが、テストでは taimei DB に
// 残存する user テーブルに直接書き込む（テスト用の暫定措置）
const user = pgTable(
  "user",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_email_key").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
    ),
  ],
);

// test-db.ts からも参照するため export
export const testTableSchema = { user, userProfile };

export const userFactory = defineFactory({
  schema: testTableSchema,
  table: "user",
  resolver: ({ sequence }) => ({
    id: `test-user-${sequence}`,
    name: `Test User ${sequence}`,
    email: `test${sequence}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  traits: {
    unverified: ({ sequence }) => ({
      id: `unverified-user-${sequence}`,
      name: `Unverified User ${sequence}`,
      email: `unverified${sequence}@example.com`,
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  },
});

export const userProfileFactory = defineFactory({
  schema: testTableSchema,
  table: "userProfile",
  resolver: ({ sequence, use: useFactory }) => ({
    id: `test-profile-${sequence}`,
    bio: `Test bio ${sequence}`,
    userId: () =>
      // eslint-disable-next-line react-hooks/rules-of-hooks -- drizzle-factory の use API、React Hook ではない
      useFactory(userFactory)
        .create()
        .then((u) => u.id),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
});

export const factory = composeFactory({
  user: userFactory,
  userProfile: userProfileFactory,
});
