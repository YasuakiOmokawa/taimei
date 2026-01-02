# 認証設計方針

## 基本方針

このプロジェクトは **JIT (Just-in-Time) プロビジョニング** の思想に沿い、**login/signup を分けない統合認証**を採用している。

## 設計

- 認証ページは `/auth` に統合（`/login`, `/signup` は存在しない）
- `accountLinking.enabled: true` で同一メールの認証方法を自動連携
- OAuth で新規ユーザーは自動登録される（`disableImplicitSignUp: false`）

## 禁止事項

- login/signup を分離する実装
- `disableImplicitSignUp: true` への変更（招待制に移行する場合を除く）
- 自前の user-create-hook による登録制御

## 背景

Better Auth の設計思想:
- OAuth では signIn と signUp が区別されていない
- デフォルトで新規ユーザーは自動登録される
- 「分けるかどうか」はフレームワークが提供する機能（`disableImplicitSignUp`）で制御する

参考: [Better Auth - OAuth Concepts](https://www.better-auth.com/docs/concepts/oauth)
