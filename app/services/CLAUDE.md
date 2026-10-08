# app/services

- Effect の中から DB と外部 API/SDK は Service 越しに触る。session と cookie は `app/lib/auth-guard.ts` が読む。Service は `Db` (drizzle) を直接使い、Repository 層は作らない。Service の書き方は `node_modules/effect/AGENTS.md` に従う。
- 結線は `index.ts` の `Live` と `RequestScoped` だけで行う。`Db` を要る Service は `RequestScoped` に置く (理由は `docs/adr/0005-row-level-security.md`)。
- 事業所データを読む Service は method 内で `CompanyContext` を `yield*` する。理由は `docs/adr/0002-company-data-scoping.md`。
