import { Schema } from "effect";

export const Tag2Id = Schema.String.check(Schema.isUUID());
