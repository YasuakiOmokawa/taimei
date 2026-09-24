# Taimei

## 前提

- 親ディレクトリに `taimei-auth` を clone (開発環境用。e2e は submodule の `vendor/taimei-auth` を使うので、先に `git submodule update --init` を実行する)
- `/etc/hosts` に `127.0.0.1 app.taimei-code.local auth.taimei-code.local`
- `.env` に `NPM_TOKEN=<read:packages 権限の GitHub PAT>` (`@taimei-code/auth-client` の取得用)
- port 3001 / 3100 / 5433 / 5434 / 5435 が空いていること

## 開発環境

taimei-auth が共有ネットワーク `taimei-network` を作るため、taimei-auth → taimei の順に起動し、逆順に停止する。

```console
cd ../taimei-auth && docker compose up --build --watch
docker compose up --build --watch   # 別ターミナルで taimei 側
```

`http://app.taimei-code.local:3001` を開く。Magic Link は `docker logs taimei-auth-auth-service-1 | grep "Magic Link"` で取得する。

## E2E

```console
E2E_SERVICE_COMMAND='npm test' \
  docker compose -p taimei-e2e -f docker-compose.e2e.yml \
  up --build --abort-on-container-exit --exit-code-from e2e
```

## 型チェック

`bun run typecheck` を使う (TypeScript 7)。bare の `typescript` は typescript-eslint と next build のために 6.0 のまま残しているので、`bun tsc` は 6.0 を指す。
