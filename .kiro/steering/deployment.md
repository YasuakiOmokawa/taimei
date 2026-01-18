# Deployment Standards

Docker Compose + Bun による開発・テスト環境。

## Philosophy

- **ローカル開発**: Docker Compose で PostgreSQL + アプリを起動
- **ホットリロード**: `--watch` モードでファイル変更を自動反映
- **テスト分離**: 専用の test_db コンテナで並列実行可能

## 環境構成

```
┌─────────────────────────────────────────────────────────┐
│                    開発環境                               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ application │  │  postgres   │  │    test_db      │ │
│  │  :3000      │  │  :5432      │  │    :5434        │ │
│  │ (Bun + Next)│  │ (本番DB相当) │  │ (テスト専用)    │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
│         └────────────────┘                   │          │
│              DATABASE_URL                    │          │
│                                    TEST_DATABASE_URL    │
└─────────────────────────────────────────────────────────┘
```

## コマンド

### 開発
```bash
# 起動（ホットリロード有効）
docker compose up --build --watch

# バックグラウンド起動
docker compose up -d --build --watch
```

### テスト
```bash
# DB起動 → 全テスト → DB停止（推奨）
bun run test:db

# 特定ファイル（test_db起動済み前提）
bun vitest run <file_path>
```

### データベース
```bash
# マイグレーション適用
bunx drizzle-kit migrate

# スキーマからSQL生成
bunx drizzle-kit generate
```

## E2E テスト

```bash
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build
```

## 環境変数

| 変数 | 用途 | 例 |
|------|------|-----|
| `DATABASE_URL` | 本番/開発DB | `postgres://...@postgres:5432/postgres` |
| `TEST_DATABASE_URL` | テストDB | `postgres://...@localhost:5434/taimei_test` |

> **注意**: `.env` ファイルはコミットしない。`.env.example` を参照。

## Docker 構成

### サービス
| サービス | イメージ | ポート | 用途 |
|----------|---------|--------|------|
| postgres | postgres:16.8-alpine | 5432 | 開発DB |
| test_db | postgres:16.8-alpine | 5434 | テストDB |
| application | Dockerfile | 3000 | Next.js アプリ |

### ヘルスチェック
各DBは `pg_isready` でヘルスチェック実施。applicationはDB起動完了後に起動。

## ホットリロード

`docker compose watch` で以下を監視:
- **sync**: ソースコード変更 → コンテナ内に即座に反映
- **rebuild**: `package.json` 変更 → コンテナ再ビルド

---
_Focus on local development patterns. No production deployment details._
