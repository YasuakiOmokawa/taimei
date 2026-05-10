import { Schema } from "effect";
import { z } from "zod";

// Effect.Schemaには組み込みemail検証がないためZodに委譲
const zodEmail = z.email();

const EmailSchema = Schema.String.pipe(
  Schema.filter((s) =>
    zodEmail.safeParse(s).success ? undefined : "無効なメールアドレス形式です",
  ),
  Schema.brand("Email"),
);

export type Email = typeof EmailSchema.Type;

export const Email = {
  Schema: EmailSchema,
  make: Schema.decodeUnknownEither(EmailSchema),
  makeSync: Schema.decodeUnknownSync(EmailSchema),
  fromTrusted: (value: string): Email => value as Email,
  // Brand 型を SDK / 外部 API の plain string param に降格する。`as string` キャストの意図を
  // 明示するための薄い helper (schema-library-usage.md の「変換器: as 前置詞」規約)。
  asString: (value: Email): string => value as string,
} as const;
