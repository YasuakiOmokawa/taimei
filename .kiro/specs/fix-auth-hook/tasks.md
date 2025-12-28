# Implementation Plan

## Tasks

- [x] 1. Auth Guard 層の実装
- [x] 1.1 (P) セッション検証機能を実装する
  - Better Auth session API を使用したセッション取得機能を作成
  - 未認証時のログインページリダイレクト（callbackUrl 付与）
  - React `cache()` による同一リクエスト内でのメモ化
  - Server Component 専用制約の実装（`'server-only'`）
  - _Requirements: 1.1, 1.2, 6.1_

- [x] 1.2 (P) ルートページの認証リダイレクトを実装する
  - セッション取得機能を使用した認証状態チェック
  - 認証済み: /dashboard へリダイレクト
  - 未認証: /login へリダイレクト
  - _Requirements: 1.1, 1.2_

- [x] 2. Better Auth databaseHooks の実装
- [x] 2.1 GitHub OAuth ログイン時の未登録ユーザー検出フックを実装する
  - OAuth state から `mode` を取得する仕組みを追加
  - `mode: 'login'` 時にユーザーが存在しない場合の作成防止
  - フラッシュ Cookie 設定（maxAge: 1 で即時削除）
  - 新規登録ページへのリダイレクト処理
  - _Requirements: 5.1_

- [ ] 3. UI コンポーネントの修正
- [x] 3.1 (P) ログイン画面の GitHub ボタンに mode パラメータを追加する
  - `additionalData: { mode: "login" }` を signIn.social に追加
  - hooks 側で login/signup を判別可能にする
  - _Requirements: 5.1_

- [x] 3.2 (P) 新規登録画面の GitHub ボタンのコールバック URL を変更する
  - 既存ユーザー検出時のコールバック URL を `/login?from=signup` に設定
  - 新規ユーザー用のコールバック URL を設定
  - _Requirements: 3.1_

- [ ] 3.3 ログインページでのフラッシュメッセージ表示機能を実装する
  - クエリパラメータ `from=signup` の検知
  - toast でエラーメッセージ表示
  - `replaceState` で URL クリーンアップ（リロード時の重複防止）
  - Suspense 境界での配置（`useSearchParams()` 対応）
  - _Requirements: 3.1_

- [x] 4. 既存レイアウトの Auth Guard 移行
- [x] 4.1 (P) dashboard レイアウトの認証チェックを Auth Guard に移行する
  - 既存の `auth.api.getSession()` + `redirect()` を `verifySession()` に置換
  - 現在のパスを `returnTo` として渡す
  - `fetchCurrentUser()` 等のユーザー情報取得は維持
  - _Requirements: 6.1_

- [x] 4.2 (P) setting レイアウトの認証チェックを Auth Guard に移行する
  - 既存の `auth.api.getSession()` + `redirect()` を `verifySession()` に置換
  - 現在のパスを `returnTo` として渡す
  - _Requirements: 6.1_

- [ ] 5. 統合テスト
- [ ] 5.1 認証フロー全体の動作確認を行う
  - ルートページの認証リダイレクト動作
  - GitHub OAuth 新規登録（既存ユーザーあり/なし）
  - GitHub OAuth ログイン（既存ユーザーあり/なし）
  - 保護ルートへの未認証アクセス → ログイン → コールバック
  - フラッシュメッセージの表示確認
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 5.1, 5.2, 6.1, 6.2, 6.3_
