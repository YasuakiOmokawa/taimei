# drizzle

- 生成は `db/drizzle/schema.ts` を変えて `bunx drizzle-kit generate --name <slug>`。文の順と CASCADE は手で直してよい (前例は 0002・0006・0008)。
- schema で表せない SQL (関数など) は `bunx drizzle-kit generate --custom --name <slug>` で空の migration を作って書く (0010)。
