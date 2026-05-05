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

`taimei + taimei-auth (認証サーバー) + DB×2 + Redis` を統合起動する。`--watch` でホットリロード。

```console
docker compose up --build --watch
```

ブラウザは `http://app.taimei-code.local:3001` でアクセス。

### 前提

- 親ディレクトリに `taimei-auth` を clone (build context `../taimei-auth`)
- `/etc/hosts` に `127.0.0.1 app.taimei-code.local auth.taimei-code.local` を追加 (sudo 必要、一度だけ)
- `.env` に `NPM_TOKEN=<read:packages 権限の GitHub PAT>` (GitHub Packages から `@taimei-code/auth-client` 取得用)
- port 3001 が空いていること (占有されている場合は `docker ps | grep 3001` で特定して `docker stop <container>` で解放)

### Magic Link

Magic Link は test mode で console 出力されるため、以下で URL を取得して手動コピペする:

```console
docker logs taimei-auth-service-1 | grep "Magic Link"
```

### ビルド時間短縮 (任意)

ビルドキャッシュを効かせて起動を高速化したい場合 (ローカルアプリの実行速度は遅くなる):

```console
docker compose build --build-arg APP_BUILD_CMD='' && docker compose up --watch
```

### ブラウザでのローカル動作確認 (2026-05-05 完了)

`docker compose up --build --watch` でローカル動作確認:

1. docker compose 起動 (ports 3001/3100 公開)
2. リモート開発環境を使う場合は、ブラウザを動かすマシンへ port を到達可能にする (port forwarding / SSH tunnel 等。ローカル開発なら不要)
3. ブラウザを動かす OS の `/etc/hosts` に `127.0.0.1 app.taimei-code.local auth.taimei-code.local` を追加
4. ブラウザ `http://app.taimei-code.local:3001/dashboard` → taimei-auth の SignIn 画面に redirect
5. メアド入力 → 「Magic Link を送信」→ `docker logs taimei-auth-service-1 | grep "Magic Link"` で URL 取得
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
