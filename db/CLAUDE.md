# db

- migration の生成と調べ方は `drizzle/CLAUDE.md`。
- 事業所のデータの読み書きは `scoped.ts` の `companyFilter` で絞る (ADR-0002 D4)。付け忘れは RLS が止める。
- アプリのコードは試験でも本番と同じ GRANT の `taimei_app` (`db/local-app-role.sql`) で DB を触る。`src/services/__tests__/db/test-db.ts` の `dbInRollback` は既定で `asAppRole` を通り、Service や関数に試験の db を渡す時は `asAppRole` の中の savepoint を渡す。seed は superuser の `tx` で書き、期待値も同じ `tx` で読む。
- SQL の中でチームが見える範囲 (管理者か、割り当てられた人) を決めるのは関数 `team_visible_to` だけにする。実行時に呼ばれない `team_list` は、`TeamReads` の絞り込みが `team_visible_to` と食い違うと落ちる試験の比べ相手なので消さない。
- id の brand (`CompanyId`・`TeamId`・`SkillId`) の値は Schema で作り、`as` は使わない。試験の事業所 id は `src/services/__tests__/db/seed.ts` の `fixtureCompanyId` で作る。
- DB のテストは `withRollback` で 1 テスト 1 transaction。一意制約の違反を見るテストは、書き込みを savepoint (`db.transaction`) に入れないと transaction ごと中断する。`set_config(..., true)` は savepoint を抜けても外側の transaction の終わりまで残る。
- 手作業の SQL と migration で `teams`・`team_assignments` を書く時は、書いた事業所ごとに、書いた後で同じ transaction の `bump_company_team_list` を呼ぶ。呼び忘れた transaction は 0016 の trigger が commit で落とすが、別の事業所を bump しても通るので、bump する事業所は書き手が書いた事業所に合わせる。手作業の SQL の後と、DB を backup から戻した後 (版が過去に戻る) は、GitHub Actions の Deploy を流し直す。流し直すまで事業所の DO に古い一覧が残る (ADR-0008)。
