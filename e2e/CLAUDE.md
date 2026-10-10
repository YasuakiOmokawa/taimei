# e2e

E2E は認証・決済など、壊れたら致命的な導線だけに書く。

## 流し方

`NPM_TOKEN=$(/opt/homebrew/bin/gh auth token) docker compose -p <名前> -f docker-compose.e2e.yml build` の後、`E2E_SERVICE_COMMAND='npm test' docker compose -p <名前> -f docker-compose.e2e.yml up --abort-on-container-exit --exit-code-from e2e`。終わったら同じ `-p` で `down --rmi local --volumes --remove-orphans`。

- ghtkn の token では `@taimei-code/auth-client` の取得が 403 になる
- build は ignore された `certs/*.pem` (社内 CA) を使うので、git worktree では `npm ci` が証明書のエラーで落ちる。別の tree で流す時は `git stash -u` で作る

## auth server

- `vendor/taimei-auth` (submodule) を build する。上げる PR はほかの変更を含めない (ADR-0003)
- e2e の app は image の build で SPA を build し、`bun run start` (`wrangler dev`) で配る。app の DB は superuser で接続し、RLS を通らない

## 手元で taimei と taimei-auth を配信する (/qa-ui)

`bun run qa:serve` が使い捨ての postgres (5446) に auth と taimei の DB を作って migrate し、`../taimei-auth` (3110、`TAIMEI_AUTH_DIR` で変えられる) と、SPA を build した taimei (3000、`wrangler dev`) を起動して、OWNER の test user の email を出す。`bun run qa:serve --app-role` は、taimei を RLS を bypass しない role (本番の `taimei_app` と同じ GRANT) で接続する。

- ログインは Chrome のフォームからその email に Magic Link を送り、`bun run qa:login` が出す file を開く (token は出力に出ず、file は 30 秒で消える)
- 終わったら `bun run qa:down` で server を止め、DB を消す
