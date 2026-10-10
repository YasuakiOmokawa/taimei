# db

- 表の定義は `drizzle/schema.ts`、migration は root の `drizzle/` (生成の手順は `drizzle/CLAUDE.md`)。
- `drizzle/client.ts` の `db` は、Node (テスト・Next) では `DATABASE_URL` の単一の Pool を、Worker では `drizzle/pool.ts` の `runWithRequestPool` が開く要求ごとの Pool を使う。`drizzle/pool.ts` を import できるのは Worker の入口と `client.ts` だけで、`biome.json` の `noRestrictedImports` が止める。入口は `biome-ignore` で 1 行だけ許す。要求ごとの Pool は、入口が渡す `waitUntil` の中で `runWithRequestPool` が閉じる。
- 事業所のデータの表は `company_id` と `companyIsolation(table)` の policy を持つ。`__tests__/rls.test.ts` が付け忘れを落とす (ADR-0005)。
- 読み書きは `scoped.ts` の `companyFilter` で絞る (ADR-0002 D4)。RLS が読む `app.company_id` は `withCompanyScope` が transaction の中だけに設定する。
- 事業所・チーム・スキルの id は `ids.ts` の brand で、列の `$type` が付ける。値は Schema で作り、`as` は使わない。`TeamId`・`SkillId` は decode で、`CompanyId` は形を検査する `make` で作る。テスト以外で `CompanyId` を作るのは、session から導く `resolveCompanyIdOrRedirect` と、DB の行を読む `purgeDeparted` だけ。
- test_db と e2e の DB は superuser で接続し、RLS を通らない。policy を観測するテストは、`app/services/__tests__/db/test-db.ts` の `switchToRoleWithoutRlsBypass` で transaction の中で BYPASSRLS の無い role に切り替える。
- DB のテストは `app/services/__tests__/db/test-db.ts` の `withRollback` で 1 テスト 1 transaction。一意制約の違反を見るテストは、書き込みを savepoint (`db.transaction`) に入れないと transaction ごと中断する。`set_config(..., true)` は savepoint を抜けても外側の transaction の終わりまで残る。
