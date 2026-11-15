import { Schema } from "effect";
import { defineTaggedUnion } from "foldkit/schema";
import { SkillLevel } from "../../../src/spa-contract";

export const ChangedByMutation = defineTaggedUnion({
  TeamList: {},
  Team: { teamId: Schema.String },
  TeamDeleted: { teamId: Schema.String },
  MyLevels: {
    teamId: Schema.String,
    myUserId: Schema.String,
    entries: Schema.Array(SkillLevel),
  },
});
export type ChangedByMutation = typeof ChangedByMutation.Type;
