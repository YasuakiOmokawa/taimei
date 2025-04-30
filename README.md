## Yasuaki Code

心安らかなソリューション。
それがYasuaki Code。

## パッケージインストール

### アプリケーション用
```console
bun install
```

### e2e用
```console
npm --prefix ./e2e install ./e2e
```

## 開発環境起動

`--watch`オプションを指定するとホットリロードが可能です。

```console
docker compose up --build --watch
```

開発環境で環境立ち上げの速度を5~60秒くらい上げたい場合、以下コマンドを実行して立ち上げる。
（ただし、ローカルアプリケーションの速度は上記と比べて遅くなる）

```console
docker compose build --build-arg APP_BUILD_CMD='' && docker compose up --watch
```

## e2eテストコマンド

```console
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build --watch
```

## e2eテストコマンド（UIモード）

```console
E2E_SERVICE_COMMAND='npm run test-ui' docker compose -f docker-compose.e2e.yml up --build --watch
```

### TODO
- [ ] パンくずリストの整備
- [ ] ファイルアップロード機能をつくる
