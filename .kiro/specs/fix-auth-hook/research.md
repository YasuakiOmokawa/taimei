# Research & Design Decisions

## Summary
- **Feature**: `fix-auth-hook`
- **Discovery Scope**: Extension（既存の Better Auth 設定への機能追加）
- **Key Findings**:
  - Magic Link のユーザー存在チェックは既に実装済み（Req 2, 4）
  - GitHub OAuth のユーザー存在チェックは Better Auth hooks で実装可能
  - 認証ミドルウェアは Next.js middleware.ts を新規作成し、既存の stackMiddleware パターンに統合

## Research Log

### Better Auth Hooks API
- **Context**: GitHub OAuth コールバック時にユーザー存在チェックを行う方法を調査
- **Sources Consulted**:
  - [Better Auth Hooks](https://www.better-auth.com/docs/concepts/hooks)
  - [Better Auth OAuth](https://www.better-auth.com/docs/concepts/oauth)
- **Findings**:
  - `signIn.social()` で `additionalData` を渡すと OAuth state に含まれる
  - `getOAuthState()` でフック内から OAuth state にアクセス可能
  - `databaseHooks.user.create.before` でユーザー作成前に介入可能
  - `after` hook で `/callback/:id` パスをマッチして処理可能
  - `ctx.redirect()` でフックからリダイレクト可能
- **Implications**:
  - `additionalData: { mode: 'login' | 'signup' }` でログイン/新規登録を区別
  - ログイン時: `databaseHooks.user.create.before` でユーザー作成を防止
  - 新規登録時: `after` hook で既存ユーザーの場合にリダイレクト

### 既存ミドルウェアパターン
- **Context**: 認証ミドルウェアの実装パターンを確認
- **Sources Consulted**: `middlewares/stackMiddleware.ts`, `middlewares/types.ts`
- **Findings**:
  - `MiddlewareFactory` 型でミドルウェアを定義
  - `stackMiddleware()` で複数ミドルウェアを合成
  - ルート `middleware.ts` は未作成
- **Implications**:
  - `middlewares/auth.ts` を新規作成し `MiddlewareFactory` パターンに従う
  - `middleware.ts` を作成し `stackMiddleware` で auth ミドルウェアを統合

### フラッシュメッセージ機能
- **Context**: 既存のフラッシュメッセージ実装を確認
- **Sources Consulted**: `lib/flash-toaster.tsx`
- **Findings**:
  - `setFlash({ type, message })` で Cookie にフラッシュを設定
  - `maxAge: 1` で1秒後に自動削除
  - Server Component から呼び出し可能
- **Implications**:
  - Better Auth hooks 内からは直接 `setFlash()` を呼べない（headers が必要）
  - 代替: リダイレクト URL にクエリパラメータでメッセージを渡す
  - クライアント側でクエリパラメータを検出してフラッシュ表示

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: hooks + query params | Better Auth hooks でリダイレクト、クエリパラメータでフラッシュ | 既存 hooks API を活用、シンプル | URL にメッセージが露出 | 採用 |
| B: カスタム API route | 独自の OAuth callback API を実装 | 完全な制御 | Better Auth の恩恵を失う | 不採用 |
| C: middleware のみ | Next.js middleware で全て処理 | 一元管理 | OAuth callback のタイミングでは session がない | 不採用 |

## Design Decisions

### Decision: GitHub OAuth ユーザー存在チェックの実装方式
- **Context**: GitHub OAuth でログイン/新規登録時にユーザー存在チェックを行う
- **Alternatives Considered**:
  1. Better Auth hooks で `additionalData` を使用
  2. カスタム API route で完全制御
  3. クライアントサイドで事前チェック（不可能）
- **Selected Approach**: Option 1 - Better Auth hooks + additionalData
- **Rationale**: Better Auth の設計に沿った実装、既存コードへの影響最小
- **Trade-offs**: hooks API の理解が必要、デバッグがやや複雑
- **Follow-up**: E2E テストで OAuth フロー全体を検証

### Decision: フラッシュメッセージの伝達方式
- **Context**: Better Auth hooks 内からフラッシュメッセージを設定する方法
- **Alternatives Considered**:
  1. クエリパラメータ経由（`?flash=account_exists`）
  2. 別の Cookie を直接設定
  3. 専用のエラーページ
- **Selected Approach**: Option 1 - クエリパラメータ経由
- **Rationale**: シンプル、既存の useSearchParams パターンと整合
- **Trade-offs**: URL にパラメータが露出するが、センシティブな情報ではない
- **Follow-up**: クライアントコンポーネントでクエリパラメータを検出してフラッシュ表示

### Decision: 認証ミドルウェアの構成
- **Context**: ルートエンドポイントと保護ルートの認証制御
- **Alternatives Considered**:
  1. Next.js middleware.ts で認証チェック
  2. 各レイアウトで個別チェック（現状）
  3. API route wrapper
- **Selected Approach**: Option 1 - Next.js middleware.ts
- **Rationale**: 一元的な認証制御、パフォーマンス、既存 stackMiddleware パターンとの統合
- **Trade-offs**: Edge Runtime の制限（Drizzle 直接使用不可）→ Better Auth の session API 使用
- **Follow-up**: Edge Runtime での Better Auth session 取得方法を確認

## Risks & Mitigations
- **Risk 1**: Better Auth hooks の動作が期待通りでない可能性 — E2E テストで検証
- **Risk 2**: Edge Runtime での制限 — Better Auth の Edge 対応 API を使用
- **Risk 3**: OAuth state のデータ検証漏れ — サーバーサイドで必ず検証

## References
- [Better Auth Hooks](https://www.better-auth.com/docs/concepts/hooks) — hooks API の詳細
- [Better Auth OAuth](https://www.better-auth.com/docs/concepts/oauth) — OAuth state, additionalData の使用方法
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware) — middleware.ts の実装
