# Research & Design Decisions

## Summary
- **Feature**: `fix-auth-hook`
- **Discovery Scope**: Extension（既存の Better Auth 設定への機能追加）
- **Key Findings**:
  - Magic Link のユーザー存在チェックは既に実装済み（Req 2, 4）
  - GitHub OAuth のユーザー存在チェックは Better Auth hooks + callbackURL で実装
  - 認証検証は Auth Guard パターン（`app/lib/auth-guard.ts`）で実装

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
  - ログイン時: `databaseHooks.user.create.before` + `additionalData: { mode: 'login' }` でユーザー作成を防止
  - 新規登録時: `callbackURL`/`newUserCallbackURL` で既存/新規を自動振り分け（`after` hook は不要）
  - `after` hook での新規/既存判別は困難（hook 実行時点で両方とも DB に存在するため）

### 認証パターン調査
- **Context**: Next.js App Router での認証ベストプラクティスを調査
- **Sources Consulted**:
  - [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
  - [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next)
- **Findings**:
  - **Better Auth 推奨**: "We recommend handling auth checks in each page/route"
  - **Next.js 推奨**: Data Access Layer (DAL) パターンでデータソース近くで認証検証
  - **Middleware の限界**: CVE-2025-29927 でバイパス可能な脆弱性が発見済み
  - **Layout での認証チェックは NG**: クライアントナビゲーションで再レンダリングされない
  - **Server Actions は Middleware をバイパス**: 個別保護が必須
- **Implications**:
  - proxy.ts/middleware.ts での認証は**オプティミスティック**（UX向上）のみ
  - セキュリティは Auth Guard (`app/lib/auth-guard.ts`) で担保
  - 各ページで `verifySession()` を呼び出すパターンを採用

### フラッシュメッセージ機能
- **Context**: 既存のフラッシュメッセージ実装を確認
- **Sources Consulted**: `lib/flash-toaster.tsx`, [Better Auth Hooks](https://www.better-auth.com/docs/concepts/hooks)
- **Findings**:
  - 既存: `setFlash({ type, message })` で Cookie にフラッシュを設定
  - `maxAge: 1` で1秒後に自動削除
  - Better Auth hooks 内では `ctx.setCookies()` が利用可能
  - `ctx.setCookies("flash", JSON.stringify({...}), { maxAge: 1 })` で同等の Cookie 設定可能
- **Implications**:
  - ログインモード（hooks 使用）: `ctx.setCookies()` でフラッシュ Cookie 設定、既存 FlashToaster で表示
  - 新規登録モード（hooks 不使用）: `callbackURL` にクエリパラメータ付与、ログインページで検知して toast 表示

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
- **Context**: OAuth 認証エラー時のフラッシュメッセージ表示方法
- **Alternatives Considered**:
  1. クエリパラメータ経由（`?from=signup`）
  2. `ctx.setCookies()` で Cookie 設定
  3. 専用 API route でリダイレクト前に Cookie 設定
- **Selected Approach**: ハイブリッド方式
  - ログインモード（未登録ユーザー）: Option 2 - hooks 内で `ctx.setCookies()` → 既存 FlashToaster
  - 新規登録モード（既存ユーザー）: Option 1 - `callbackURL: "/login?from=signup"` → ログインページで検知
- **Rationale**:
  - ログインモード: hooks (`create.before`) が発火するので Cookie 設定可能
  - 新規登録モード: hooks (`after`) での新規/既存判別が困難（タイミング問題）のためクエリパラメータ使用
  - 認証専用のフラッシュなので影響範囲が限定的
- **Trade-offs**: 2 つの方式が混在（ただし認証フローに閉じている）
- **Follow-up**: -

### Decision: 認証パターンの構成
- **Context**: ルートエンドポイントと保護ルートの認証制御
- **Alternatives Considered**:
  1. Next.js proxy.ts で認証チェック（一元管理）
  2. 各レイアウトで個別チェック（現状）
  3. **Data Access Layer (DAL) パターン**（各ページで verifySession）
- **Selected Approach**: Option 3 - DAL パターン
- **Rationale**:
  - Next.js / Better Auth 両方の公式推奨パターン
  - セキュリティ: データソース近くで検証（CVE-2025-29927 対策）
  - カスタマイズ性: ライブラリ自動生成エンドポイントに影響しない
  - シンプル: proxy.ts の追加コード不要
- **Trade-offs**:
  - 各ページで `verifySession()` 呼び出しが必要（ボイラープレート）
  - ページ読み込み開始後にリダイレクト（proxy.ts より若干遅い）
- **Follow-up**: -

## Risks & Mitigations
- **Risk 1**: Better Auth hooks の動作が期待通りでない可能性 — E2E テストで検証
- **Risk 2**: OAuth state のデータ検証漏れ — サーバーサイドで必ず検証

## References
- [Better Auth Hooks](https://www.better-auth.com/docs/concepts/hooks) — hooks API の詳細
- [Better Auth OAuth](https://www.better-auth.com/docs/concepts/oauth) — OAuth state, additionalData の使用方法
- [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next) — Next.js での認証パターン推奨
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — DAL パターン、セキュリティベストプラクティス
