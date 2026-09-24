# app/domain

- 単一値のドメイン型は Effect Schema の brand で作り、`email.ts` の `make` / `makeSync` / `fromTrusted` の形に揃える。フォーム入力の検証は Zod (Conform) で行う。
- Zod の `.transform()` 内で `fromTrusted()` を呼ばない (Next.js SSG + Bun で壊れる)。Server Action で Conform の検証後に `fromTrusted()` する。
