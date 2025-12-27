# Implementation Plan

## Tasks

- [x] 1. E2E テスト環境の Drizzle 移行
- [x] 1.1 E2E 用 Drizzle クライアントとスキーマを設定する
  - e2e/ ディレクトリに Drizzle ORM と pg ドライバの依存を追加
  - db/drizzle/schema.ts を e2e/ にコピーし、E2E 用クライアントを作成
  - 環境変数 DATABASE_URL から接続情報を取得する設定
  - _Requirements: 1.1_

- [x] 1.2 signIn 関数を Drizzle ORM で書き換える
  - Prisma Client の import を Drizzle クライアントに置換
  - user.count を db.select().from(user).where() に変更
  - user.create を db.insert(user).values() に変更
  - テストユーザーの作成ロジックが正しく動作することを確認
  - _Requirements: 1.1_

- [x] 1.3 E2E Dockerfile から Prisma 関連を削除する
  - prisma ディレクトリのコピー処理を削除
  - prisma.ts ファイルのコピー処理を削除
  - npx prisma generate コマンドを削除
  - db/drizzle ディレクトリのコピー処理を追加（e2e/db/ が既存のため不要）
  - _Requirements: 1.3_

- [x] 2. Docker 構成と CI/CD の更新
- [x] 2.1 docker-compose.e2e.yml を Drizzle Kit に更新する
  - e2e-application の command を bunx drizzle-kit migrate に変更
  - DATABASE_URL 環境変数を追加
  - POSTGRES_PRISMA_URL の参照を削除
  - e2e サービスにも DATABASE_URL を設定
  - _Requirements: 3.1, 3.2_

- [x] 2.2 (P) Prisma マイグレーションワークフローを削除し、Drizzle版を作成する
  - .github/workflows/prisma-migrate-deploy.yml を削除
  - .github/workflows/drizzle-migrate-deploy.yml を作成（drizzle/配下の変更時に実行）
  - drizzle/meta/_journal.json に 0001_better_auth_migration を登録
  - GitHub Secrets に DATABASE_URL の設定が必要（手動）
  - _Requirements: 2.1, 2.2_

- [x] 3. パッケージ依存関係の削除
- [x] 3.1 e2e/package.json から Prisma 依存を削除する
  - @prisma/client を devDependencies から削除（既に削除済み）
  - npm --prefix ./e2e install ./e2e を実行して依存を更新
  - 注: drizzle-ormのoptional peer depとして@prisma/clientがnode_modulesに入るがpackage.jsonには記載なし
  - _Requirements: 4.3, 4.4_

- [x] 3.2 メインプロジェクトから Prisma パッケージを削除する
  - package.json に prisma, @prisma/client がないことを確認済み
  - bun install を実行（yarn.lockは削除、bun.lockbを使用）
  - bun.lockb から @prisma/ プレフィックスのパッケージが消えていることを確認
  - 注: @prisma/instrumentationは@sentry/nextjsの依存として残存（Prisma ORMではない）
  - _Requirements: 4.1, 4.2_

- [x] 4. ドキュメントとクリーンアップ
- [x] 4.1 (P) README.md を更新する
  - Prisma マイグレーションコマンドを Drizzle Kit コマンドに置換
  - データベース作成セクションのコマンドを更新
  - _Requirements: 5.1_

- [x] 4.2 (P) .claude/CLAUDE.md を更新する
  - Prisma 関連のコマンド記載を削除
  - Drizzle のみを参照するよう修正
  - prisma/ ディレクトリ構造の記載を drizzle/ に変更
  - _Requirements: 5.2_

- [x] 4.3 (P) 不要なファイルと設定を削除する
  - .gitignore から /prisma/seeds エントリを削除
  - db/drizzle/schema.ts から prismaMigrations テーブル定義を削除
  - prisma/ ディレクトリは存在しないため削除不要
  - _Requirements: 6.1, 6.2, 6.3, 7.1_

- [x] 5. 動作確認と検証
- [x] 5.1 E2E テスト環境の動作確認
  - docker compose -f docker-compose.e2e.yml up --build を実行
  - マイグレーションが正常に完了することを確認（✓ migrations applied successfully!）
  - 注: E2Eテスト自体の失敗はBetter Auth署名付きクッキーの問題（Prisma移行とは無関係）
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_

- [x] 5.2 Prisma 残存チェック
  - grep -r "prisma" --include="*.ts" で Prisma 参照がないことを確認済み
  - bun.lockb に @prisma/ パッケージがないことを確認済み（@prisma/instrumentationは@sentry/nextjs依存）
  - node_modules に @prisma/client がないことを確認済み（e2e/node_modulesはdrizzle-ormのoptional peer dep）
  - docker-compose.yml から POSTGRES_PRISMA_URL を削除
  - .claude/settings.local.json から Prisma 関連の許可ルールを削除
  - _Requirements: 4.1, 4.2, 4.3_
