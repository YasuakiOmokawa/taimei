# Taimei

心安らかなソリューション。
それが Taimei

# パッケージインストール

## アプリケーション用

```console
bun install
```

## e2e 用

```console
npm --prefix ./e2e install ./e2e
```

# データベース作成

```console
docker compose exec application node_modules/.bin/prisma migrate deploy
```

# 開発環境起動

`--watch`オプションを指定するとホットリロードが可能です。

```console
docker compose up --build --watch
```

上記コマンド実行後、以下コマンドを実行して立ち上げると起動時間が早くなります。
（ただし、ローカルアプリケーションの速度は上記と比べて遅くなります）

```console
docker compose build --build-arg APP_BUILD_CMD='' && docker compose up --watch
```

# テストコマンド

## e2e テスト

```console
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build
```

## e2e テスト（UI モード）

```console
E2E_SERVICE_COMMAND='npm run test-ui' docker compose -f docker-compose.e2e.yml up --build --watch
```

# TODO

- [ ] パンくずリストの整備
- [ ] 画像がうまく調整できない。調整幅が低すぎる
- [ ] StoryBook の適用
