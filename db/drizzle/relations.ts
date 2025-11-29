import { relations } from "drizzle-orm/relations";
import { customers, invoices, invoicesTotags, tags } from "./schema";

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
