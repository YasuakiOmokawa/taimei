# Taimei

心安らかなソリューション。
それが Taimei

## パッケージインストール

### アプリケーション用

```console
bun install
```

### e2e 用

```console
npm --prefix ./e2e install ./e2e
```

## データベースマイグレーション

```console
bunx drizzle-kit migrate
```

## 開発環境起動

taimei は認証を別 compose (`taimei-auth`) に依存する。**先に taimei-auth、次に taimei** の順でマニュアル起動する。共有ネットワーク `taimei-network` は taimei-auth 側 compose が作成主 (taimei 側は external 参照)。

### Step 1: taimei-auth (認証サーバー + DB + Redis)

```console
cd ../taimei-auth
docker compose up --build --watch
```

`auth-postgres` / `auth-redis` / `auth-migrate` / `auth-service` が起動し、共有ネットワーク `taimei-network` を作成する。`auth-service` は alias `auth.taimei-code.local:3100` で公開される。

### Step 2: taimei (Next.js + DB×2)

別ターミナルで:

```console
docker compose up --build --watch
```

`postgres` / `test_db` / `application` が起動し、external network `taimei-network` に join する。`application` は alias `app.taimei-code.local:3001` で公開される。

ブラウザは `http://app.taimei-code.local:3001` でアクセス。

### 前提

- 親ディレクトリに `taimei-auth` を clone (taimei-auth 側 compose が独立に build / migrate を実行)
- `/etc/hosts` に `127.0.0.1 app.taimei-code.local auth.taimei-code.local` を追加 (sudo 必要、一度だけ)
- `taimei/.env` に `NPM_TOKEN=<read:packages 権限の GitHub PAT>` (GitHub Packages から `@taimei-code/auth-client` 取得用)
- `taimei-auth/.env` に `AUTH_SECRET` 等が設定済 (詳細は taimei-auth リポの README 参照)
- 以下の port が空いていること (占有時は `docker ps | grep <port>` で特定して `docker stop <container>` で解放):
  - 3001 (taimei application) / 3100 (auth-service)
  - 5433 (taimei postgres) / 5434 (taimei test_db) / 5435 (auth-postgres) / 6380 (auth-redis)

### 停止順

逆順 (taimei → taimei-auth) で停止する。taimei-auth を先に止めると network が消えて taimei 側が orphan エラーになる場合がある。

```console
# taimei 側 (本リポ)
docker compose down

# taimei-auth 側 (network も削除される)
cd ../taimei-auth && docker compose down
```

### Magic Link

Magic Link は test mode で console 出力されるため、taimei-auth 側のコンテナログから取得して手動コピペする:

```console
docker logs taimei-auth-auth-service-1 | grep "Magic Link"
```

> container 名は taimei-auth project prefix (`taimei-auth-`) が付く。`docker ps` で実名を確認すること。

### ビルド時間短縮 (任意)

ビルドキャッシュを効かせて起動を高速化したい場合 (taimei application のローカル実行速度は遅くなる):

```console
docker compose build --build-arg APP_BUILD_CMD='' && docker compose up --watch
```

### ブラウザでのローカル動作確認 (2026-05-05 完了)

> 当時は taimei + taimei-auth が単一 compose で統合起動だった。現在は 2 段階起動だが、ブラウザ側の動作確認手順は同等。

1. Step 1 → Step 2 の順で `docker compose up --build --watch` (ports 3001/3100 公開)
2. リモート開発環境を使う場合は、ブラウザを動かすマシンへ port を到達可能にする (port forwarding / SSH tunnel 等。ローカル開発なら不要)
3. ブラウザを動かす OS の `/etc/hosts` に `127.0.0.1 app.taimei-code.local auth.taimei-code.local` を追加
4. ブラウザ `http://app.taimei-code.local:3001/dashboard` → taimei-auth の SignIn 画面に redirect
5. メアド入力 → 「Magic Link を送信」→ `docker logs taimei-auth-auth-service-1 | grep "Magic Link"` で URL 取得
6. URL をブラウザで開く → /dashboard 着地 ✅

これで認証統合のエンドツーエンド動作 (proxy → taimei-auth → Magic Link → cookie → /dashboard) が手動で確認できた。`.local` TLD は macOS の Bonjour 解決で問題になる可能性があったが今回は無事動作。

## E2E テスト

```console
E2E_SERVICE_COMMAND='npm test' \
  docker compose -p taimei-e2e -f docker-compose.e2e.yml \
  up --build --abort-on-container-exit --exit-code-from e2e
```

`-p taimei-e2e` で dev compose と project / volume を分離。詳細は `e2e/README.md` 参照。

### UI モード

```console
E2E_SERVICE_COMMAND='npm run test-ui' \
  docker compose -p taimei-e2e -f docker-compose.e2e.yml \
  up --build --watch
```

# TODO

- [ ] パンくずリストの整備
- [ ] 画像がうまく調整できない。調整幅が低すぎる
- [ ] StoryBook の適用
