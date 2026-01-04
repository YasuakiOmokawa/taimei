import { Schema } from "effect";

// HTML5 email input 準拠
// ref: https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const EmailSchema = Schema.String.pipe(
  Schema.filter((s) => EMAIL_REGEX.test(s), {
    message: () => "無効なメールアドレス形式です",
  }),
  Schema.brand("Email")
);

export type Email = typeof EmailSchema.Type;

export const Email = {
  Schema: EmailSchema,
  make: Schema.decodeEither(EmailSchema),
  makeSync: Schema.decodeSync(EmailSchema),
  fromTrusted: (value: string): Email => value as Email,
} as const;
