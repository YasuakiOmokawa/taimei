# staging の手作業と作り直しの手順

staging (定義は taimei-auth の `GLOSSARY.md`) のうち、IaC の定義 (`infra/alchemy.run.ts`) に載せない資源を人が作る手順と、staging を消して作り直す手順である。判断は [ADR-0011](../adr/0011-staging-follows-taimei-auth.md) と、それが従う taimei-auth の ADR-0022 にある。taimei-auth の staging (同じ Cloudflare のアカウント、Zero Trust の組織、Secrets Store、service token) は作ってある前提で、ここには taimei で足すものだけを書く。

## 前提

- staging は本番と別の Cloudflare のアカウント (workers.dev のサブドメイン `taimei-staging`) と、本番と別の Neon project に置く
- 本番の資源と本番の credential には、この手順のどこでも触れない
- 値 (password・token・secret) は手元の端末で生成し、この文書・repo・issue・チャットに書かない
- wrangler を使う shell では、staging のアカウントの `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` を設定し、`bunx wrangler whoami` が staging のアカウントだけを出すことを確かめてから始める
- 0 ドルで作れない資源があれば、そこで止め、費用と代わりの案を issue に書いて判断を仰ぐ

## 1. Neon project

1. Neon で staging 用の project を Free で作る。region は taimei-auth の staging の DB と同じにする
2. owner の直接接続の接続文字列 (pooler でないもの) を控える。5 節で GitHub の Environment `staging` の `DATABASE_URL` に入れる

- 載せない理由: project を作れる Neon の key は本番の project にも届くので、CI に置かない

## 2. DB の SQL (Worker の role と本番以外の DB の印)

Worker の role の password を手元で生成する (`openssl rand -hex 24`)。3 節の Hyperdrive でも使う。

1 の project の SQL Editor (branch `main`、owner の database) で、次の SQL を流す。`<owner>` は project の owner の role (Neon の既定は `neondb_owner`)、`<password>` は生成した値に置き換える。

```sql
CREATE ROLE taimei_app LOGIN PASSWORD '<password>';
GRANT USAGE ON SCHEMA public TO taimei_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taimei_app;
ALTER DEFAULT PRIVILEGES FOR ROLE <owner> IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taimei_app;
CREATE TABLE non_production_database (marked_at timestamptz NOT NULL DEFAULT now());
SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'taimei_app';
```

- 最後の `SELECT` が両方 `false` を返すことを確かめる。`true` なら role を消し、Neon の画面や API ではなく SQL で作り直す (画面や API で作る role は RLS を bypass する。ADR-0005)
- `non_production_database` は本番以外の DB の印である。staging の Worker の入口と deploy の job は、この表が無い DB では動かない。migration には入れず、本番の DB には作らない
- 載せない理由: 印の表を migration に入れないため。role の password を repo にも CI にも置かないため

## 3. Hyperdrive

`taimei_app` の接続文字列で、staging のアカウントに Hyperdrive を作る。

```bash
bunx wrangler hyperdrive create taimei-staging \
  --connection-string="postgres://taimei_app:<password>@<host>/<db>?sslmode=require"
```

- `<host>` は 2 と同じく、pooler でない直接接続の host (`-pooler` の付かないもの) にする。Hyperdrive が自分で pool を持つ
- 名前は `infra/stages.ts` の `hyperdriveName` と同じにする。定義は名前で引く
- query cache は本番の taimei の Hyperdrive の設定に揃える。本番の dashboard で caching が無効なら `--caching-disabled` を付ける
- 載せない理由: 定義で作ると role の password が state と GitHub に入る

## 4. Secrets Store と Access

何もしない。

- `AUTH_SERVICE_KEY` は taimei-auth が登録した secret を同じ名前で使う。定義が binding を作る
- Access の application と policy は定義が Worker と一緒に作る。service token は taimei-auth の CI と同じ 1 本を使う。Worker の Access タブや Self-hosted の application を手で作らない (taimei-auth の runbook の Access の節)

## 5. GitHub の Environment と secret

1. Environment `staging` を作り、使える branch を `main` に絞る。次の secret を入れる
   - `CLOUDFLARE_API_TOKEN`: staging のアカウントの token。taimei-auth の staging の token と同じ権限 (Workers Scripts・Secrets Store・Access の apps と policies の Edit、Hyperdrive と Account Settings の Read) で、taimei 用に別に発行する
   - `CLOUDFLARE_ACCOUNT_ID`: staging のアカウントの ID
   - `DATABASE_URL`: 1 の owner の接続文字列
   - `ACCESS_CLIENT_ID`・`ACCESS_CLIENT_SECRET`: taimei-auth の Environment `staging` と同じ service token
2. Environment `Production` の使える branch を `main` に絞る

- `NPM_TOKEN` は lint・試験・e2e も使う読み取りの token なので、repo 全体の secret のまま残す

## 6. 最初の deploy

`deploy.yml` の本番の job が `needs: staging` を持つと、staging が通るまで本番に出せない。次の順で入れる。

1. 1〜5 を終える
2. PR-A (staging の job まで。本番の job に `needs: staging` が無い) を merge し、main の Deploy の job `staging` が通ることを確かめる
3. staging の URL (`https://taimei-staging.taimei-staging.workers.dev/dev-home`) から開発用アカウントでログインし、チームの作成・自分のレベルの記入・メンバーの一覧まで通ることを確かめる
4. PR-B (本番の job に `needs: staging`) を merge する。以後は main の push ごとに staging、本番の順に進む

## 7. 消して作り直す

定義から作り直せることを確かめる時と、staging が壊れて戻せない時に行う。

1. 手元で staging の credential を設定し、repo root で `bunx alchemy destroy infra/alchemy.run.ts --stage staging` を流す
2. 最新の Deploy の run の job `staging` を re-run する (本番は出し直さない)
3. 6 の 3 の操作が通ることを確かめる

- 手作業の資源 (Neon project、Hyperdrive、Secrets Store、service token) は消えずに残る。Access の application は Worker と一緒に消え、2 で作り直される
- taimei-auth の staging も作り直す時は、消すのは taimei が先、作るのは taimei-auth が先にする。taimei-auth を先に消すと、taimei の Service Binding が消えた script を指したまま残る
