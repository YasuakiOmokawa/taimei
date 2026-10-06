# e2e

E2E は認証・決済など、壊れたら致命的な導線だけに書く。

## 流し方

`NPM_TOKEN=$(/opt/homebrew/bin/gh auth token) docker compose -p <名前> -f docker-compose.e2e.yml build` の後、`E2E_SERVICE_COMMAND='npm test' docker compose -p <名前> -f docker-compose.e2e.yml up --abort-on-container-exit --exit-code-from e2e`。終わったら同じ `-p` で `down --rmi local --volumes --remove-orphans`。

- ghtkn の token では `@taimei-code/auth-client` の取得が 403 になる
- build は ignore された `certs/*.pem` (社内 CA) を使うので、git worktree では `npm ci` が証明書のエラーで落ちる。別の tree で流す時は `git stash -u` で作る

## auth server

- `vendor/taimei-auth` (submodule) を build する。上げる PR はほかの変更を含めない (ADR-0003)
- 事業所の切り替え・除名・退会は、taimei-auth の API を cookie を持つ `BrowserContext.request` で叩く (`tests/isolation.spec.ts`)。user・company・membership の用意だけは `tests/utils/signIn.ts` が auth の DB に直接書く
- e2e の app の DB は superuser で接続し、RLS を通らない

## 手元で taimei と taimei-auth を配信する (/qa-ui)

手元の 3100・5435 は ssh のトンネルが使うので避ける。

1. 使い捨ての postgres (`docker-compose.e2e.yml` と同じ image を 5446 で `docker run`) に `auth` と `taimei` の DB を作り、migrate する (auth は `../taimei-auth` で `bun run db:migrate && bun run db:migrate-manual`、taimei は `bunx drizzle-kit migrate`)
2. auth: `../taimei-auth` で `bun run src/index.ts` を 3110 で起動する。env は `docker-compose.e2e.yml` の `e2e-auth-service` と同じ値 (`AUTH_SECRET` など) に、`APP_ENV=development`、`PORT`・`AUTH_SERVICE_URL` を 3110、`AUTH_TRUSTED_ORIGINS` に 3000 と 3110 を渡す。`AUTH_SERVICE_KEY` と `AUTH_SERVICE_KEY_PREVIOUS` は空にする (2 リポジトリの `.env` の値が違い、そのままだと VerifySession が 401)
3. taimei: `NEXT_PUBLIC_AUTH_URL=http://localhost:3110 NEXT_PUBLIC_APP_URL=http://localhost:3000 AUTH_SERVICE_URL=http://localhost:3110 DATABASE_URL=<taimei の DB> bun run dev`
4. user・company・membership は auth の DB に psql で入れる (列は `tests/utils/signIn.ts`)
5. ログインは Chrome のフォームから Magic Link を送り、auth のログの link を shell の変数から一時 HTML (meta refresh) に書いて `file://` で開き、開いたらすぐ消す (token を出力に出さない)。Chrome の幅が狭いとサイドバーは描画されない (1280 で確かめた)
6. 終わったら `UPDATE "user" SET revision = revision + 1` で session を無効にし、server と postgres を止める
