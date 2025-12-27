# Implementation Plan

## Tasks

- [ ] 1. E2E テスト環境の Drizzle 移行
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

- [ ] 2. Docker 構成と CI/CD の更新
- [x] 2.1 docker-compose.e2e.yml を Drizzle Kit に更新する
  - e2e-application の command を bunx drizzle-kit migrate に変更
  - DATABASE_URL 環境変数を追加
  - POSTGRES_PRISMA_URL の参照を削除
  - e2e サービスにも DATABASE_URL を設定
  - _Requirements: 3.1, 3.2_

- [ ] 2.2 (P) Prisma マイグレーションワークフローを削除する
  - .github/workflows/prisma-migrate-deploy.yml を削除
  - Drizzle マイグレーションワークフローが必要な場合は別途作成（本タスクではスコープ外）
  - _Requirements: 2.1, 2.2_

- [ ] 3. パッケージ依存関係の削除
- [ ] 3.1 e2e/package.json から Prisma 依存を削除する
  - @prisma/client を devDependencies から削除
  - npm --prefix ./e2e install ./e2e を実行して依存を更新
  - e2e/package-lock.json から Prisma 関連エントリが消えていることを確認
  - _Requirements: 4.3, 4.4_

- [ ] 3.2 メインプロジェクトから Prisma パッケージを削除する
  - package.json に prisma, @prisma/client がないことを確認（既に削除済みの想定）
  - bun install を実行して yarn.lock を更新
  - yarn.lock から @prisma/ プレフィックスのパッケージが消えていることを確認
  - _Requirements: 4.1, 4.2_

- [ ] 4. ドキュメントとクリーンアップ
- [ ] 4.1 (P) README.md を更新する
  - Prisma マイグレーションコマンドを Drizzle Kit コマンドに置換
  - データベース作成セクションのコマンドを更新
  - _Requirements: 5.1_

- [ ] 4.2 (P) .claude/CLAUDE.md を更新する
  - Prisma 関連のコマンド記載を削除
  - Drizzle のみを参照するよう修正
  - prisma/ ディレクトリ構造の記載を削除
  - _Requirements: 5.2_

- [ ] 4.3 (P) 不要なファイルと設定を削除する
  - .gitignore から /prisma/seeds エントリを削除
  - db/drizzle/schema.ts から prismaMigrations テーブル定義を削除
  - prisma/ ディレクトリが存在する場合は削除
  - _Requirements: 6.1, 6.2, 6.3, 7.1_

- [ ] 5. 動作確認と検証
- [ ] 5.1 E2E テスト環境の動作確認
  - docker compose -f docker-compose.e2e.yml up --build を実行
  - マイグレーションが正常に完了することを確認
  - signIn 関数を使用するテストが正常に動作することを確認
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_

- [ ] 5.2 Prisma 残存チェック
  - grep -r "prisma" --include="*.ts" で Prisma 参照がないことを確認（node_modules 除外）
  - yarn.lock に @prisma/ パッケージがないことを確認
  - node_modules に @prisma ディレクトリがないことを確認
  - _Requirements: 4.1, 4.2, 4.3_
