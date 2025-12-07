# Requirements Document

## Project Description (Input)
このプロジェクトからprismaパッケージを完全に削除

## Background & Context

### 現状分析
プロジェクトはすでに Drizzle ORM への移行が完了しているが、Prisma の痕跡が残存：

| カテゴリ | 対象 | 詳細 |
|----------|------|------|
| **依存関係** | yarn.lock | @prisma/client, prisma 関連パッケージ |
| **E2E依存** | e2e/package.json | @prisma/client ^6.7.0 |
| **E2Eコード** | e2e/tests/utils/signIn.ts | Prisma Client によるテストユーザー作成 |
| **E2E Dockerfile** | e2e/Dockerfile | prisma ディレクトリのコピー、prisma generate 実行 |
| **CI/CD** | .github/workflows/prisma-migrate-deploy.yml | Prisma マイグレーションワークフロー |
| **Docker Compose** | docker-compose.e2e.yml | bunx prisma migrate deploy コマンド |
| **ドキュメント** | README.md, .claude/CLAUDE.md | Prisma コマンドの記載 |
| **DBスキーマ** | db/drizzle/schema.ts | _prisma_migrations テーブル定義 |
| **マイグレーション** | drizzle/0000_safe_songbird.sql | _prisma_migrations テーブル作成SQL |
| **.gitignore** | .gitignore | /prisma/seeds エントリ |

### 移行済み要素
- ORM: Drizzle ORM（db/drizzle/）
- マイグレーション: Drizzle Kit（drizzle/）
- DBクライアント: pg + @effect/sql-pg

---

## Requirements

### REQ-1: E2Eテストコードの Drizzle 移行
**ID**: REQ-1
**Priority**: High
**Type**: Functional

When E2Eテストが実行されるとき, the E2E Test Suite shall Drizzle ORM を使用してテストデータを操作する。

#### Acceptance Criteria
- AC-1.1: When signIn 関数が呼び出されるとき, the signIn function shall Drizzle クライアントを使用してテストユーザーを作成する
- AC-1.2: The E2E package.json shall @prisma/client 依存を含まない
- AC-1.3: The E2E Dockerfile shall prisma 関連のコピーおよび generate コマンドを含まない

---

### REQ-2: CI/CD パイプラインの更新
**ID**: REQ-2
**Priority**: High
**Type**: Infrastructure

The CI/CD Pipeline shall Drizzle Kit のマイグレーションコマンドを使用する。

#### Acceptance Criteria
- AC-2.1: The .github/workflows/ shall prisma-migrate-deploy.yml を含まない
- AC-2.2: If Drizzle マイグレーションワークフローが必要な場合, the Workflow shall drizzle-kit migrate コマンドを使用する

---

### REQ-3: Docker 構成の更新
**ID**: REQ-3
**Priority**: High
**Type**: Infrastructure

The Docker Compose Configuration shall Drizzle のマイグレーションコマンドを使用する。

#### Acceptance Criteria
- AC-3.1: When docker-compose.e2e.yml の e2e-application が起動するとき, the Container shall Drizzle Kit のマイグレーションコマンドを実行する
- AC-3.2: The docker-compose.e2e.yml shall prisma コマンドの参照を含まない

---

### REQ-4: パッケージ依存関係の削除
**ID**: REQ-4
**Priority**: High
**Type**: Cleanup

The Project shall Prisma 関連のパッケージ依存を含まない。

#### Acceptance Criteria
- AC-4.1: The package.json shall prisma, @prisma/client を dependencies/devDependencies に含まない
- AC-4.2: When bun install が実行された後, the yarn.lock shall @prisma/ プレフィックスのパッケージを含まない
- AC-4.3: The e2e/package.json shall @prisma/client を含まない
- AC-4.4: When e2e/package.json が更新された後, `npm --prefix ./e2e install ./e2e` を実行して依存関係を更新する

---

### REQ-5: ドキュメントの更新
**ID**: REQ-5
**Priority**: Medium
**Type**: Documentation

The Project Documentation shall Drizzle ORM のみを参照する。

#### Acceptance Criteria
- AC-5.1: The README.md shall Prisma コマンドの記載を含まず、Drizzle Kit コマンドを記載する
- AC-5.2: The .claude/CLAUDE.md shall Prisma の参照を含まず、Drizzle のみを参照する

---

### REQ-6: 不要ファイル・設定の削除
**ID**: REQ-6
**Priority**: Medium
**Type**: Cleanup

The Project shall Prisma 関連の不要なファイルおよび設定を含まない。

#### Acceptance Criteria
- AC-6.1: The .gitignore shall /prisma/seeds エントリを含まない
- AC-6.2: The db/drizzle/schema.ts shall _prisma_migrations テーブル定義を含まない（本番DBのテーブル削除は別タスク）
- AC-6.3: If prisma/ ディレクトリが存在する場合, the Project shall そのディレクトリを含まない

---

### REQ-7: DBマイグレーションテーブルの整理
**ID**: REQ-7
**Priority**: Low
**Type**: Database

The Drizzle Schema shall Prisma マイグレーション履歴テーブルを管理しない。

#### Acceptance Criteria
- AC-7.1: The db/drizzle/schema.ts shall prismaMigrations エクスポートを含まない
- AC-7.2: 注意: 本番DBの _prisma_migrations テーブル削除は本要件のスコープ外（データ移行完了後に別途対応）

---

## Out of Scope
- 本番データベースの _prisma_migrations テーブルの削除（既存データへの影響を考慮し、別タスクで対応）
- Drizzle マイグレーションの新規作成（既存の drizzle/ ディレクトリを使用）

## Dependencies
- Drizzle ORM が正しく設定されていること
- E2E テストが Drizzle を使用して動作すること

## Test Scenarios

### TS-1: E2Eテストの動作確認
**Covers**: REQ-1

1. E2E テスト環境を起動
2. signIn 関数を使用するテストを実行
3. テストが正常に完了することを確認

### TS-2: CI/CDパイプラインの動作確認
**Covers**: REQ-2

1. main ブランチへのプッシュ時にワークフローが正しく動作
2. Prisma 関連のワークフローが実行されないことを確認

### TS-3: Docker環境の動作確認
**Covers**: REQ-3

1. `docker compose -f docker-compose.e2e.yml up --build` を実行
2. マイグレーションが正常に完了することを確認
3. アプリケーションが起動することを確認

### TS-4: 依存関係の確認
**Covers**: REQ-4

1. `bun install` 実行後、node_modules に prisma 関連パッケージがないことを確認
2. yarn.lock に @prisma/ パッケージがないことを確認
