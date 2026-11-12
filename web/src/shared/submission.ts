import { Schema } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

export const Submission = defineTaggedUnion({
  Idle: {},
  Submitting: {},
  Rejected: { message: Schema.String },
});
