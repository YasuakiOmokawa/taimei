# ADR-0011: staging は taimei-auth の ADR-0022 に従って alchemy v2 で宣言し、100% に出して確かめてから本番に進む

- **Status**: Accepted
- **Date**: 2026-11-01
- **References**: #647、#648、ADR-0005、ADR-0010、taimei-auth の ADR-0022 と `docs/runbook/staging.md`、taimei-auth の `GLOSSARY.md` の **staging** と **本番以外**

## Context

taimei には常設の staging が無く、main への push がそのまま本番に出る。taimei-auth は ADR-0022 で、staging を本番と別の Cloudflare アカウントと Neon project に置き、alchemy v2 で宣言すると決めた。consumer の taimei も同じ道具とアカウントに従う。

taimei-auth と違うところがある。taimei の本番の deploy は `wrangler deploy` の 1 手順で、0% の gate を持たない。override header が効いたことを照合する `/health` も無い。本番の secret は `wrangler secret` で、`src/` は Secrets Store を知らない。

## Decision

- 道具・版・アカウント・Access・Neon の分け方・Hyperdrive を人が作ること・secret の値を IaC に通さないことは、taimei-auth の ADR-0022 に従う。state の置き場は Worker `alchemy-state-store-taimei` (`Cloudflare.state` の `workerName`)
- staging の job は alchemy で 100% に出し、smoke が通った時だけ本番の job に進む (`deploy.yml` の `needs: staging`)。0% の gate と、DO の変更のための手動の 100% の workflow は作らない
- smoke は、staging の入口だけが付ける response header の version を、wrangler の 100% の version と比べてから確かめる。本番の code に version の口を足さない
- staging の入口 `testing/staging-worker.ts` は `testing/worker.ts` を包み (ADR-0010)、最初の要求と定期処理の前に、Secrets Store の `AUTH_SERVICE_KEY` を文字列に解いて渡し、DB に本番以外の DB の印の表 (`non_production_database`) があるかを確かめる。印が無ければ応答も定期処理もしない。staging の job も migrate の前に同じ印を確かめる
- 定義は互換の日付と flag・assets の配り方・DO の binding・cron を `wrangler.jsonc` から読み、値を写さない。stage の表が持つのは Worker・Hyperdrive・auth の Worker の名前だけで、vars は `AUTH_URL` だけ。`AUTH_SERVICE_URL` は staging に置けない
- staging は Sentry に送らない

## Considered Options

- **taimei-auth と同じ 0% の gate**: 本番の code に version を返す口が要り、DO の変更だけ別の workflow に回す判断も要る。壊れた version が本番に進まないことは 100% + `needs` でも守れる
- **`src/worker.ts` で Secrets Store の binding を解く (taimei-auth の形)**: 本番が今は使わない経路が本番の入口に入る。本番が Secrets Store に移る #648 で改めて決める
- **定数を写して等値の試験で止める (taimei-auth の形)**: 試験は止めるが、写しが無ければずれる場所そのものが無い
- **Worker の印の検査を省く**: #657 の後は staging の auth が知らない事業所を定期処理が消さないが、人が作る Hyperdrive の接続先の取り違えを止めるものが無くなる

## Consequences

- smoke が落ちた version は staging に 100% で残る。本番には進まず、staging は直す deploy で戻す。staging が壊れている間は本番にも出せない
- taimei-auth の GLOSSARY の **staging** は「本番と同じ deploy の手順を確かめる場所」だが、taimei では #648 で本番を alchemy に移すまで、本番は `wrangler deploy`、staging は alchemy で出す。staging が確かめるのは code・migrate・資源の組み合わせで、本番の deploy の手順そのものではない
- `wrangler.jsonc` の DO の binding を外すと、alchemy は staging の namespace をデータごと消す。staging に本物の個人の情報は置かない
- staging は taimei-auth の staging と同じ Free のアカウントの枠を使い、本番の枠は使わない

## #648 で足したこと (2026-11-04)

- **本番も同じ定義で出す**: `infra/stages.ts` に stage `production` を足した。Worker の名前・入口・custom domain・auth の Worker の名前・vars は `wrangler.jsonc` から導き、表に写さない。Hyperdrive は `wrangler.jsonc` に id しか無く、定義は名前で引くので、名前 `taimei` だけを表に書く。stage の差 (custom domain か Access つきの workers.dev か、入口、secret の置き場) は表の値で表し、定義は stage の名前で分岐しない
- **本番の deploy も 100% に出す**: main の push の本番の job は、表の入口で bundle を作り、migrate の後に `alchemy deploy --stage production` で出す。staging と同じく gate を持たない。これで Context の「本番は `wrangler deploy` の 1 手順」と Consequences の「staging は deploy の手順そのものを確かめない」は当たらなくなった。staging と本番で違うのは、入口 (本番以外の入口か本番の入口か) と secret の置き場だけである
- **本番の secret は `secret_text` のまま**: `AUTH_SERVICE_KEY`・`SENTRY_DSN` は `wrangler secret put` で入れ、Secrets Store に移さない。taimei は gate を持たず、Worker の script を丸ごと上げ直す deploy だけで出す。この deploy は `secret_text` を引き継ぐ (taimei-auth の ADR-0022 の R1)。値を回すと新しい version がすぐ出るので、すでに動いている isolate (Worker の実行単位) が古い値を持ち続けない。Secrets Store に移すと、本番の Secrets Store にある taimei-auth の同名の secret (`SENTRY_DSN`・`AUTH_SERVICE_KEY`) と名前を分ける必要があり、`src/` の secret の解決と Sentry の DSN の読み方、100% での切り替えが要る。0% の gate (`version: { traffic: 0 }` での version の upload) は `secret_text` を落とすので、本番に gate を足す時は secret の置き場を決め直す
- **drift の検出**: `IaC drift` の workflow が毎日と手動で、本番の Worker の今の deployment の version ごとの binding (本番の 2 つの secret は `secret_text` として期待する) と、`alchemy plan`・`alchemy drift` を比べる。差があれば失敗する
- **取り込み**: 人が 1 回、PR の branch から `--adopt` で取り込み、その後に merge する。予行演習はしない。taimei-auth が同じアカウントと同じ alchemy の版で、`secret_text`・DO のデータ・custom domain が残ることを観測している (ADR-0022 の R1・R4)。手順は `docs/runbook/production.md`
- **費用**: 本番のアカウントに増えるのは alchemy の state の置き場だけで、課金の表示なしに作れる (taimei-auth で観測)。alchemy の既定で本番の Workers Logs が有効になりうるが、Free の 1 日 200,000 件に収まる。追加の費用は無い
