# Authentication Standards

Better Auth による統合認証の設計方針。

## Philosophy

- **JIT (Just-in-Time) プロビジョニング**: login/signup を分けない
- **accountLinking**: 同一メールの認証方法を自動連携
- **セッションベース**: Cookie + httpOnly

## Authentication Methods

| 方法 | 説明 |
|------|------|
| GitHub OAuth | ソーシャルログイン |
| Magic Link | メールリンク認証（5分有効） |

> Email/Password は無効化（`emailAndPassword.enabled: false`）

## Flow

```
┌─────────────────────────────────────────────────────────┐
│                    /auth ページ                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐     ┌─────────────────────────────┐   │
│  │ GitHub OAuth │ OR │ Magic Link (メール入力)     │   │
│  └──────┬──────┘     └──────────────┬──────────────┘   │
│         │                           │                   │
│         ▼                           ▼                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Better Auth: ユーザー存在チェック                  │  │
│  │ - 存在: ログイン                                   │  │
│  │ - 不在: 自動登録 → ウェルカムメール送信            │  │
│  └──────────────────────────────────────────────────┘  │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Session Cookie 発行 (5分キャッシュ)               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Account Linking

同一メールアドレスの認証方法を自動連携:
```typescript
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: [], // GitHub で上書きしない
  },
},
```

## Session Management

- **Storage**: httpOnly Cookie
- **Cache**: 5分間 Cookie にキャッシュ（DB クエリ削減）
- **Secure**: 本番環境では `__Secure-` プレフィックス

## Hooks

### Session 作成時
```typescript
hooks: {
  after: createAuthMiddleware(async (ctx) => {
    if (ctx.context.newSession) {
      // Flash メッセージ設定
      // 新規ユーザーにウェルカムメール送信
    }
  }),
},
```

## Effect-TS Service 統合

```typescript
// app/services/auth-service.ts
export class AuthService extends Effect.Service<AuthService>()(
  "services/AuthService",
  {
    effect: Effect.gen(function* () {
      return {
        signOut: () => Effect.tryPromise({...}),
        sendMagicLink: (email, redirectPath) => Effect.tryPromise({...}),
      };
    }),
  }
) {}
```

## 禁止事項

- **login/signup 分離**: 統合認証を維持
- **`disableImplicitSignUp: true`**: 招待制移行時のみ許可
- **自前の user-create-hook**: Better Auth のフローを使用

## 関連ファイル

```
lib/
├── auth.ts              # Better Auth サーバー設定
├── auth-client.ts       # クライアント設定
└── auth/
    ├── messages/        # メッセージコード
    └── hooks/           # カスタムフック

app/
├── auth/                # /auth ページ（統合認証）
└── api/auth/[...all]/   # Better Auth ハンドラー
```

---
_Focus on patterns and decisions. No library-specific implementation details._
