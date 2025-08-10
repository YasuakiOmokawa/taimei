import { relations } from "drizzle-orm/relations";
import {
  customers,
  invoices,
  user,
  session,
  userProfile,
  invoicesTotags,
  tags,
  authenticator,
  account,
} from "./schema";

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  invoicesTotags: many(invoicesTotags),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  invoices: many(invoices),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  userProfiles: many(userProfile),
  authenticators: many(authenticator),
  accounts: many(account),
}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id],
  }),
}));

export const invoicesTotagsRelations = relations(invoicesTotags, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoicesTotags.a],
    references: [invoices.id],
  }),
  tag: one(tags, {
    fields: [invoicesTotags.b],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  invoicesTotags: many(invoicesTotags),
}));

export const authenticatorRelations = relations(authenticator, ({ one }) => ({
  user: one(user, {
    fields: [authenticator.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
