import { Schema } from "effect";

// taimei-auth の company.id は cmp_ + nanoid(24)。列は varchar(32)
export const CompanyId = Schema.String.check(
  Schema.isPattern(/^cmp_[\w-]{1,28}$/),
).pipe(Schema.brand("CompanyId"));
export type CompanyId = typeof CompanyId.Type;

const Uuid = Schema.String.check(Schema.isUUID());

export const TeamId = Uuid.pipe(Schema.brand("TeamId"));
export type TeamId = typeof TeamId.Type;

export const SkillId = Uuid.pipe(Schema.brand("SkillId"));
export type SkillId = typeof SkillId.Type;
