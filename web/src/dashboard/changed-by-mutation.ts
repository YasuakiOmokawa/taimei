import { Schema, Struct } from "effect";
import { defineTaggedUnion } from "foldkit/schema";
import { TeamDetail } from "../../../src/spa-contract";

const MyLevelEntry = TeamDetail.fields.levels.value.mapFields(
  Struct.omit(["userId"]),
);

export const ChangedByMutation = defineTaggedUnion({
  TeamList: {},
  Team: { teamId: Schema.String },
  TeamDeleted: { teamId: Schema.String },
  MyLevels: {
    teamId: Schema.String,
    myUserId: Schema.String,
    entries: Schema.Array(MyLevelEntry),
  },
});
export type ChangedByMutation = typeof ChangedByMutation.Type;
