# Requirements Document

## Introduction

認証フロー全体の動作を改善し、ユーザー体験を向上させる。ルートエンドポイントでの自動リダイレクト、新規登録/ログイン画面での重複アカウント・未登録アカウント検出、および保護ルートへの未認証アクセス時のリダイレクト＆コールバック機能を実装する。

## Requirements

### Requirement 1: ルートエンドポイントの認証リダイレクト

**Objective:** As a 認証済みユーザー, I want ルートエンドポイント（/）にアクセスした際に自動的にダッシュボードに遷移したい, so that ログイン後の画面遷移がスムーズになる

#### Acceptance Criteria

1. When 認証済みユーザーがルートエンドポイント（/）にアクセスする, the Auth Middleware shall /dashboard にリダイレクトする
2. When 未認証ユーザーがルートエンドポイント（/）にアクセスする, the Auth Middleware shall /login にリダイレクトする

### Requirement 2: 新規登録画面での既存アカウント検出（Magic Link）

**Objective:** As a 既存ユーザー, I want 新規登録画面で誤ってMagic Link送信を試みた際にログイン画面への誘導を受けたい, so that 重複登録を防ぎスムーズにログインできる

#### Acceptance Criteria

1. When ユーザーが新規登録画面でMagic Link送信ボタンを押下する and 入力されたemailがDBに既に存在する, the Auth Service shall フラッシュメッセージを表示し、ログイン画面への遷移を促す
2. When ユーザーが新規登録画面でMagic Link送信ボタンを押下する and 入力されたemailがDBに存在しない, the Auth Service shall 通常のMagic Link送信処理を実行する

### Requirement 3: 新規登録画面での既存アカウント検出（GitHub OAuth）

**Objective:** As a 既存ユーザー, I want 新規登録画面で誤ってGitHubログインを試みた際にログイン画面への誘導を受けたい, so that 重複登録を防ぎスムーズにログインできる

#### Acceptance Criteria

1. When ユーザーが新規登録画面でGitHubログインボタンを押下する and GitHub認証後に取得したemailがDBに既に存在する, the Auth Service shall フラッシュメッセージを表示し、ログイン画面への遷移を促す
2. When ユーザーが新規登録画面でGitHubログインボタンを押下する and GitHub認証後に取得したemailがDBに存在しない, the Auth Service shall 通常の新規登録処理を実行する

### Requirement 4: ログイン画面での未登録アカウント検出（Magic Link）

**Objective:** As a 新規ユーザー, I want ログイン画面で誤ってMagic Linkログインを試みた際に新規登録画面への誘導を受けたい, so that アカウント未登録状態であることを認識し、スムーズに新規登録できる

#### Acceptance Criteria

1. When ユーザーがログイン画面でMagic Linkログインボタンを押下する and 入力されたemailがDBに存在しない, the Auth Service shall フラッシュメッセージを表示し、新規登録画面への遷移を促す
2. When ユーザーがログイン画面でMagic Linkログインボタンを押下する and 入力されたemailがDBに存在する, the Auth Service shall 通常のMagic Linkログイン処理を実行する

### Requirement 5: ログイン画面での未登録アカウント検出（GitHub OAuth）

**Objective:** As a 新規ユーザー, I want ログイン画面で誤ってGitHubログインを試みた際に新規登録画面への誘導を受けたい, so that アカウント未登録状態であることを認識し、スムーズに新規登録できる

#### Acceptance Criteria

1. When ユーザーがログイン画面でGitHubログインボタンを押下する and GitHub認証後に取得したemailがDBに存在しない, the Auth Service shall フラッシュメッセージを表示し、新規登録画面への遷移を促す
2. When ユーザーがログイン画面でGitHubログインボタンを押下する and GitHub認証後に取得したemailがDBに存在する, the Auth Service shall 通常のログイン処理を実行する

### Requirement 6: 保護ルートへの未認証アクセス制御

**Objective:** As a 未認証ユーザー, I want 保護されたページにアクセスした際にログイン画面にリダイレクトされ、ログイン後に元のページに戻りたい, so that セキュリティを保ちながらも目的のページにスムーズにアクセスできる

#### Acceptance Criteria

1. While ユーザーが未認証状態である, when ログイン画面・新規登録画面以外のエンドポイントにアクセスする, the Auth Middleware shall /login にリダイレクトし、元のURLをコールバックパラメータとして保持する
2. When ユーザーがログインに成功する and コールバックパラメータが存在する, the Auth Service shall コールバックパラメータで指定されたURLにリダイレクトする
3. When ユーザーがログインに成功する and コールバックパラメータが存在しない, the Auth Service shall /dashboard にリダイレクトする
4. The Auth Middleware shall /login, /signup, /api/auth/* をパブリックルートとして認証なしでアクセス可能にする
