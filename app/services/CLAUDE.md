# app/services

- Effect の中から DB と外部 API/SDK は Service 越しに触る。session と cookie は `app/lib/auth-guard.ts` が読む。Service は `Db` (drizzle) を直接使い、Repository 層は作らない。Service の書き方は `node_modules/effect/AGENTS.md` に従う。
- 結線は `index.ts` の `Live`・`RequestScoped`・`ManagerScoped` だけで行う。`Db` を要る Service は `RequestScoped` か `ManagerScoped` に置く (理由は `docs/adr/0005-row-level-security.md`)。
- 実行口 (`runService`・`runScopedService`・`runManagerScopedService`) の失敗の型は `TeamFailure` に限る。Service に失敗の型を足したら `team-errors.ts` の `TeamFailure` に入れ、`app/lib/team-failure.ts` の表に文言と Sentry に送るかどうかを書く (書くまで型エラーになる)。
- 管理者だけの操作は `TeamManagement` に置き、method で role を見ない。管理者かどうかは `TeamManagement.layer` を組み立てる時に 1 回だけ判定し、管理者でなければ組み立てが `NotManager` で失敗する。この Layer は `ManagerScoped` として `runManagerScopedService` だけが provide する。
- 事業所データを読む Service は method 内で `CompanyContext` を `yield*` する。理由は `docs/adr/0002-company-data-scoping.md`。
- レベルを記入する人のチームへの割り当て、記入するスキルがそのチームにあること、名前の一意は、事前の query で確かめない。`team-service.ts` の `runWrite` で savepoint の中で書き、制約の違反を tagged error に写す (制約の名前は `db/drizzle/schema.ts` の定数)。レベルを 1 つも送らない保存だけは書き込みが無いので、割り当てを読んで確かめる。
