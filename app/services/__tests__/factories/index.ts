import { defineFactory, composeFactory } from "@praha/drizzle-factory";
import { user, userProfile } from "@/db/drizzle/schema";

// drizzle-factory は relations 含むスキーマを受け付けないため、テーブルのみ抽出
const tableSchema = { user, userProfile };

export const userFactory = defineFactory({
  schema: tableSchema,
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
  schema: tableSchema,
  table: "userProfile",
  resolver: ({ sequence, use: useFactory }) => ({
    id: `test-profile-${sequence}`,
    bio: `Test bio ${sequence}`,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    userId: () => useFactory(userFactory).create().then((u) => u.id),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
});

export const factory = composeFactory({
  user: userFactory,
  userProfile: userProfileFactory,
});
