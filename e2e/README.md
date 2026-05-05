# E2E テスト

Playwright + Docker Compose で taimei + taimei-auth (認証サーバー) を統合的に検証する。

## 構成

```
docker-compose.e2e.yml
├── e2e-postgres        (taimei DB, port 5433)
├── e2e-auth-postgres   (taimei-auth DB, port 5435)
├── e2e-auth-redis      (Better Auth secondary storage)
├── e2e-auth-service    (taimei-auth, port 3100, alias: auth.taimei-code.local)
├── e2e-application     (taimei Next.js, port 3001, alias: app.taimei-code.local)
└── e2e                 (Playwright runner)
```

すべて同じ `e2e-network` 内で `app/auth.taimei-code.local` を network alias で解決する。Cookie domain `.taimei-code.local` で cross-subdomain SSO を成立させる。

## 前提

### 1. `/etc/hosts` 設定 (一度だけ)

ブラウザから host port 経由でアクセスする場合のみ必要。Playwright runner は同 network 内で動くため不要。

```bash
sudo sh -c 'echo "127.0.0.1 app.taimei-code.local auth.taimei-code.local" >> /etc/hosts'
```

### 2. `NPM_TOKEN`

`@taimei-code/auth-client` (GitHub Packages, private) を build 時に install するため `read:packages` 権限を持つ GitHub PAT が必要。プロジェクトルート `.env` に書いておけば docker compose が自動読み込み。

### 3. taimei-auth sibling repo

`docker-compose.e2e.yml` は `context: '../taimei-auth'` を参照する。同じ親ディレクトリに taimei-auth を clone しておく:

```
parent/
├── taimei/
└── taimei-auth/   ← 必須
```

### 4. port 衝突回避

dev container や grafana 等が port 3001/3100/5433/5435 を占有していないこと:

```bash
docker stop freee-mcp-grafana-1 2>/dev/null   # 例: 3001 占有を解放
```

## 実行

### 全テスト実行

```bash
E2E_SERVICE_COMMAND='npm test' \
  docker compose -p taimei-e2e -f docker-compose.e2e.yml \
  up --build --abort-on-container-exit --exit-code-from e2e
```

`-p taimei-e2e` は dev compose (`docker-compose.yml`) と project / volume を分離するため必須。

### 特定 spec のみ実行 (高速)

```bash
E2E_SERVICE_COMMAND='npx playwright test --grep "未認証で保護ルート" --reporter=line --retries=0' \
  docker compose -p taimei-e2e -f docker-compose.e2e.yml \
  up --build --abort-on-container-exit --exit-code-from e2e
```

### Cleanup

```bash
docker compose -p taimei-e2e -f docker-compose.e2e.yml down
```

`--volumes` を付けると `auth-pg-data` / `pg-data` も削除される (DB を完全リセットしたい時)。

## ログの確認

### Magic Link URL の取得 (test mode で console 出力)

```bash
docker logs taimei-e2e-e2e-auth-service-1 2>&1 | grep "Magic Link"
# → [TEST] Magic Link for foo@example.com: http://auth.taimei-code.local:3100/api/auth/magic-link/verify?token=xxx&callbackURL=...
```

### Playwright HTML report

`./playwright-report/index.html` (test 結果)
`./test-results/<test-name>/error-context.md` + `trace.zip` (失敗時の DOM snapshot / 再生)

## test 構成

| spec | 内容 |
|------|------|
| `auth.spec.ts` | taimei-auth 経由の認証フロー全 7 件 (未認証 redirect / Magic Link / taimei-auth 画面遷移 / Error 画面) |
| `dashboard.spec.ts` | dashboard ページの表示確認 |

`tests/utils/signIn.ts` の `signInWithMagicLink` helper が:
1. `/api/auth/sign-in/magic-link` を fetch (verification record DB 書き込み)
2. `verification` table を post-filter で検索 (Better Auth の value format `{email,name?,attempt}` 対応)
3. raw token を `/api/auth/magic-link/verify?token=...` に渡す
4. Set-Cookie を BrowserContext に注入 (cross-subdomain `.taimei-code.local`)

## トラブルシューティング

### `Verification token not found after 20 attempts`
→ Better Auth が `secondaryStorage` (Redis) のみに保存している。`taimei-auth/src/auth.ts` で `verification.storeInDatabase: isTestEnvironment()` が設定されていることを確認。

### SPA 画面が真っ白 / locator timeout
→ Vite bundle に `local` allowlist が含まれていない可能性。`docker exec taimei-e2e-e2e-auth-service-1 grep -c "local" web/dist/assets/*.js` で確認。0 件なら `APP_ENV=test` build args が docker-compose.e2e.yml で渡っているか確認。

### `relation "user" does not exist`
→ migration 未実行。`e2e-auth-service.command` に `bunx drizzle-kit migrate` が含まれていることを確認。

### port 3001 衝突
→ `docker stop freee-mcp-grafana-1` 等で占有プロセスを停止。

## ローカル開発時の動作確認 (e2e と別)

実際にブラウザで認証フローを動かす場合は **dev compose (`docker-compose.yml`)** を使う。詳細は project ルートの `README.md` 参照。
