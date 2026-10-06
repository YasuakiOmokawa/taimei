import { Schema } from "effect";
import { NAME_MAX_LENGTH } from "@/db/drizzle/schema";

export const TeamOrSkillName = Schema.Trim.check(
  Schema.isLengthBetween(1, NAME_MAX_LENGTH),
);
