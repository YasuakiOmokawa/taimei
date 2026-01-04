import { Schema } from "effect";
import { z } from "zod";

// Effect.Schemaには組み込みemail検証がないためZodに委譲
const zodEmail = z.email();

const EmailSchema = Schema.String.pipe(
  Schema.filter(
    (s) => (zodEmail.safeParse(s).success ? undefined : "無効なメールアドレス形式です")
  ),
  Schema.brand("Email")
);

export type Email = typeof EmailSchema.Type;

export const Email = {
  Schema: EmailSchema,
  make: Schema.decodeUnknownEither(EmailSchema),
  makeSync: Schema.decodeUnknownSync(EmailSchema),
  fromTrusted: (value: string): Email => value as Email,
} as const;
