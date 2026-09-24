# app/services

- DB、外部 API/SDK、`next/headers`、`crypto.randomUUID` 等のグローバルは Service 越しに触る。Service は `Db` (drizzle) を直接使い、Repository 層は作らない。形は `customer-service.ts` に揃える。
- 結線は `index.ts` の `Live` だけで行う。テスト用の差し替えは static `layerTest` に置く。
- 事業所データを読む Service は method 内で `CompanyContext` を `yield*` する。理由は `docs/adr/0002-company-data-scoping.md`。
