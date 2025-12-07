# Research & Design Decisions

## Summary
- **Feature**: `remove-prisma`
- **Discovery Scope**: Simple Addition (削除・クリーンアップ作業)
- **Key Findings**:
  - Drizzle ORM は既に完全に設定済み（db/drizzle/, drizzle.config.ts）
  - E2E テストのみ Prisma に依存（signIn.ts）
  - 環境変数 `DATABASE_URL` は Drizzle 用に設定済み

## Research Log

### Drizzle マイグレーションコマンド
- **Context**: Prisma migrate deploy の代替コマンドを特定
- **Sources Consulted**: drizzle.config.ts, Drizzle Kit ドキュメント
- **Findings**:
  - `npx drizzle-kit migrate` がマイグレーション適用コマンド
  - 環境変数 `DATABASE_URL` を使用
  - 既存の drizzle/ ディレクトリにマイグレーションファイルあり
- **Implications**: docker-compose.e2e.yml と CI/CD で Drizzle Kit コマンドに置換可能

### E2E テストの Drizzle 移行
- **Context**: signIn.ts が Prisma Client を使用
- **Sources Consulted**: e2e/tests/utils/signIn.ts, db/drizzle/client.ts
- **Findings**:
  - 現在: `import { prisma } from "@/prisma"` で Prisma Client 使用
  - 移行先: `import { db } from "@/db/drizzle/client"` で Drizzle 使用
  - user テーブルスキーマは db/drizzle/schema.ts に定義済み
  - `db.insert(user).values({...})` と `db.select().from(user).where(...)` で置換可能
- **Implications**: E2E テストコードの軽微な修正で移行可能

### 環境変数の整理
- **Context**: POSTGRES_PRISMA_URL vs DATABASE_URL
- **Sources Consulted**: docker-compose.e2e.yml, docker-compose.yml, drizzle.config.ts
- **Findings**:
  - Drizzle は `DATABASE_URL` を使用
  - docker-compose.yml には `DATABASE_URL` が設定済み
  - docker-compose.e2e.yml には `POSTGRES_PRISMA_URL` のみ（Prisma 用）
- **Implications**: docker-compose.e2e.yml に `DATABASE_URL` を追加する必要あり

## Architecture Pattern Evaluation

本作業は削除・クリーンアップのため、新規アーキテクチャパターンの評価は不要。

## Design Decisions

### Decision: E2E テストでの Drizzle 使用方法
- **Context**: Prisma Client を Drizzle に置換する方法
- **Alternatives Considered**:
  1. E2E 用の別 Drizzle クライアントを作成
  2. 既存の db/drizzle/client.ts を再利用
- **Selected Approach**: 既存の db/drizzle/client.ts を E2E にコピーして使用
- **Rationale**: E2E は Docker コンテナで独立実行されるため、tsconfig パス解決の関係で別途コピーが必要
- **Trade-offs**: コード重複が発生するが、E2E の独立性を維持
- **Follow-up**: E2E Dockerfile で db/drizzle をコピーするよう修正

### Decision: 環境変数名の統一
- **Context**: Prisma 用変数 vs Drizzle 用変数
- **Alternatives Considered**:
  1. POSTGRES_PRISMA_URL を DATABASE_URL にリネーム
  2. 両方の変数を並行して設定
- **Selected Approach**: DATABASE_URL を追加し、POSTGRES_PRISMA_URL は削除
- **Rationale**: Prisma 関連の痕跡を完全に削除するため
- **Trade-offs**: 環境変数名の変更は影響範囲が広いが、Drizzle の標準に合わせる

## Risks & Mitigations
- **Risk 1**: E2E テストが動作しなくなる — E2E 環境での動作確認を実施
- **Risk 2**: CI/CD パイプラインが失敗する — ワークフロー削除前に Drizzle 対応を確認
- **Risk 3**: 本番 DB の _prisma_migrations テーブル — スコープ外として維持、別途対応

## References
- [Drizzle Kit Migrate](https://orm.drizzle.team/docs/migrations) — マイグレーションコマンド
- [drizzle-orm/node-postgres](https://orm.drizzle.team/docs/get-started/postgresql-node-postgres) — PostgreSQL 接続設定
