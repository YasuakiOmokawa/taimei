# 本番の取り込みと、IaC の外に残る手作業

本番の資源は `infra/alchemy.run.ts` の stage `production` で宣言する。本番の値 (Worker の名前・入口・custom domain・auth の Worker の名前・vars) は `wrangler.jsonc` から導き、`infra/stages.ts` に写さない。判断の理由は [ADR-0011](../adr/0011-staging-follows-taimei-auth.md) の「#648 で足したこと」と、それが従う taimei-auth の ADR-0022 にある。

## 前提

- 本番のアカウントの token の権限: Workers Scripts Edit、Secrets Store Edit (alchemy の state の置き場が鍵と token を置く)、Workers Routes Edit (custom domain)、Zone Read、Hyperdrive Read、Account Settings Read。Environment `Production` の `CLOUDFLARE_API_TOKEN` もこの権限にする
- 手元で本番の token を使うのは「1 回だけの手順」の間だけにする。短い期限の token を作り、終わったら消す。手元の `ALCHEMY_HOME` は一時 dir にし、終わったら消す (state の置き場の token が cache される)
- 0 ドルで作れない資源や課金の表示が出たら、そこで止め、費用と代わりの案を issue に書いて判断を仰ぐ

## 1 回だけの手順 (#648 の取り込み)

taimei-auth の取り込み (ADR-0022 の R1〜R7) を同じアカウントと同じ alchemy の版で観測済みなので、予行演習はしない。代わりに、取り込みの plan を目で確かめ、だめなら `wrangler rollback` で戻す。

### 棚卸し

1. 本番の token を shell に置き (`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`)、`bun infra/check-worker.ts production` を流す。差が `ASSETS (assets) is declared but not live` (alchemy が取り込みで足す) と observability (定義は有効にする) だけであることを確かめる。ほかの差があれば止めて表を直す
2. Environment `Production` の `CLOUDFLARE_API_TOKEN` を前提の権限の token に替える

### 取り込み

1. main に他の PR を merge しない期間を始める。main の push の本番の job はまだ `wrangler deploy` で script を置き換え、alchemy の所有の印を外しうる
2. PR の branch で `bash scripts/build-bundle.sh production`
3. 取り込み前の 100% の version を `bunx wrangler deployments status --name taimei` で控える
4. `bunx alchemy plan infra/alchemy.run.ts --stage production` が `OwnedBySomeoneElse` で止まることを見る (`--adopt` なしでは何も変えない)
5. `bunx alchemy deploy infra/alchemy.run.ts --stage production --adopt` (`--yes` を付けない)。表示された plan に `delete`・`unbind`・`replace` が無く、Worker `taimei` が取り込みか更新だけであることを見てから進める
6. 確かめる: `bun infra/check-worker.ts production` が通る。`https://app.taimei-code.com` でログインし、取り込み前からあるチームの星取表が出て、自分のレベルを記入できる (auth への RPC が通る)。次の毎時 17 分の後、Workers Logs に `purge-departed` の行が出る
7. だめなら `bunx wrangler rollback <控えた version> --name taimei` で戻して止める。前の version は自分の `secret_text` で動く
8. PR を merge → Deploy の job `staging` と `Deploy` が通る → `IaC drift` を main から手動で起動して差が無い → main の merge を再開する → 手元の token と `ALCHEMY_HOME` を消す

## 日々の変更

- 資源と binding の変更は `infra/` か `wrangler.jsonc` を変える PR で行い、main の push の Deploy が staging、本番の順に 100% で出す。Durable Object の追加・改名・削除も同じ経路で出る。DO の binding を `wrangler.jsonc` から消すと、データごと namespace が消える
- `wrangler deploy` と `wrangler versions upload` を本番に使わない。定義を通らない version ができ、alchemy の所有の印が外れうる
- `alchemy destroy --stage production` を使わない。DO のデータごと消える
- secret の値は `bunx wrangler secret put <名前> --name taimei` で変える。新しい version がすぐ出るので、古い値を持つ isolate は残らない。`AUTH_SERVICE_KEY` を回す順は taimei-auth の `docs/runbook/service-key-rotation.md` に従う (taimei は consumer の側)
- 本番に 0% の gate (`version: { traffic: 0 }`) を足す前に、secret の置き場を決め直す。gate は `secret_text` を落とす (理由は ADR-0011 の「#648 で足したこと」)
- `wrangler rollback` で戻した後は、次の main の push の deploy で定義に戻るまで `IaC drift` が差を報告する
- `IaC drift` が落ちたら、出力の差を見て、定義に戻すか定義を直す PR を出す。dashboard で足した var と `wrangler secret put` で足した secret は binding の比較だけが拾い、alchemy の deploy では消えないので dashboard で消す。外れた custom domain は `alchemy drift` が拾い、alchemy の deploy で付け直る (taimei-auth の ADR-0022 の R6)
- Hyperdrive を作り直す時、`wrangler hyperdrive create` の最後の「Would you like Wrangler to add it on your behalf?」に no と答える。yes にすると `wrangler.jsonc` の Hyperdrive の id が書き換わる

## IaC の外に残るもの

| もの | 理由 |
|---|---|
| secret の値 (`AUTH_SERVICE_KEY`・`SENTRY_DSN`、`secret_text`) | 値を定義・state・CI に通さない |
| Hyperdrive `taimei` | 接続の password を state に入れない。定義は名前で引く |
| Neon の project・DB・role `taimei_app` | project を作れる key は本番の DB にも届くので CI に置かない |
| zone `taimei-code.com` の custom domain 以外の DNS | Worker の資源ではなく、taimei-auth と共有している |
| GitHub の Environment と Cloudflare の token | token を作る権限を CI に渡さない |
| `wrangler.jsonc` | local の開発 (`wrangler dev`) と bundle の build に使い、定義が本番の値を読む出どころでもある |
| alchemy の state の置き場 (Worker `alchemy-state-store-taimei` と、Secrets Store の鍵と token) | 最初の deploy が作る。消すと state を失う |
