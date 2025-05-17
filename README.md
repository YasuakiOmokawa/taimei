# Taimei

心安らかなソリューション。
それがTaimei

# パッケージインストール

## アプリケーション用
```console
bun install
```

## e2e用
```console
npm --prefix ./e2e install ./e2e
```

# 開発環境起動

`--watch`オプションを指定するとホットリロードが可能です。

```console
docker compose up --build --watch
```

開発環境で環境立ち上げの速度を5~60秒くらい上げたい場合、以下コマンドを実行して立ち上げます。
（ただし、ローカルアプリケーションの速度は上記と比べて遅くなります）

```console
docker compose build --build-arg APP_BUILD_CMD='' && docker compose up --watch
```

# テストコマンド

## e2eテスト
```console
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build
```

## e2eテスト（UIモード）

```console
E2E_SERVICE_COMMAND='npm run test-ui' docker compose -f docker-compose.e2e.yml up --build --watch
```

# TODO
- [ ] パンくずリストの整備
- [ ] 画像がうまく調整できない。調整幅が低すぎる
- [ ] クリッピング画像の選択ボタン押下時、sending...とならない
