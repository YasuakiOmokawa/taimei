# Better Auth 認証マイクロサービス分離プラン

## Context

新プロダクトを作るたびに認証機能（ログイン/サインアップ/SSO/招待）を再実装するコストを排除するため、現在 taimei に組み込まれている Better Auth 認証基盤を独立したマイクロサービスとして切り出す。

**現状の課題:**
- Better Auth が Next.js + Drizzle + Effect-TS と密結合（`nextCookies()`, `auth.api.getSession()` 直接呼び出し等）
- 認証テーブル（user, session, account, verification）がビジネステーブルと同一DBに存在
- `userProfile` だけが `user` テーブルに FK 結合（ビジネステーブル customers/invoices/tags は独立）

**ゴール:**
- 認証専用マイクロサービス（Hono + Better Auth）を構築
- gRPC（ConnectRPC）でサービス間通信
- 親ドメイン Cookie（`.taimei-code.com`）でプロダクト間セッション共有
- taimei を認証マイクロサービスのクライアントに移行

---

## アーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────────────────────────────┐
│                        ブラウザ                                   │
│  app1.taimei-code.com          app2.taimei-code.com                     │
│  (taimei)                  (将来のプロダクト)                      │
│  ├─ GithubAuthButton       ├─ ...                               │
│  │  → auth.taimei-code.com     │  → auth.taimei-code.com                │
│  └─ EmailLinkForm          └─ ...                               │
│     → Server Action           → Server Action                   │
└─────────┬──────────────────────────┬────────────────────────────┘
          │                          │
          │ Cookie (domain=.taimei-code.com)
          │                          │
┌─────────▼──────────────────────────▼────────────────────────────┐
│              auth.taimei-code.com (認証マイクロサービス)                │
│  ┌──────────────────┐  ┌──────────────────────┐                 │
│  │ HTTP (Better Auth)│  │ gRPC (ConnectRPC)    │                 │
│  │ /api/auth/*       │  │ VerifySession        │                 │
│  │ OAuth callback    │  │ GetUser              │                 │
│  │ Magic Link        │  │ FindAccount          │                 │
│  │ Cookie 発行       │  │ Invite (Organization)│                 │
│  └────────┬─────────┘  └──────────┬───────────┘                 │
│           └──────────┬────────────┘                              │
│                      ▼                                           │
│          ┌──────────────────┐  ┌─────────┐                      │
│          │ PostgreSQL (auth) │  │  Redis   │                      │
│          │ user, session,    │  │ (cache)  │                      │
│          │ account,          │  └─────────┘                      │
│          │ verification,     │                                    │
│          │ organization,     │                                    │
│          │ member, invitation│                                    │
│          └──────────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 技術選定

| 要素 | 選定 | 理由 |
|------|------|------|
| 認証サービス FW | **Hono** | Better Auth が公式サポート。軽量・高速 |
| gRPC 実装 | **ConnectRPC (connect-es)** | HTTP/1.1 + HTTP/2 対応。Hono と同一ポートで HTTP API と gRPC を共存可能 |
| Proto 管理 | **Buf** | ConnectRPC のエコシステム。コード生成・lint 統合 |
| セッション | **Cookie (domain=.taimei-code.com) + Redis** | `crossSubDomainCookies` で公式サポート。Redis でセッション検証を高速化 |
| 招待 | **Better Auth Organization プラグイン** | 招待/ロール/チーム管理を網羅 |
| SSO | **Better Auth SSO プラグイン** | SAML/OIDC RP として動作。エンタープライズ対応 |
| モノレポ | **Turborepo** | proto 定義・クライアント SDK を共有パッケージ化 |

### Cookie ドメイン共有設計

```typescript
// 認証サービス側の Better Auth 設定
betterAuth({
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: "taimei-code.com"  // .taimei-code.com 配下で共有
    }
  },
  trustedOrigins: [
    "https://app1.taimei-code.com",
    "https://app2.taimei-code.com"
  ]
})
```

### セッション検証の 3 層キャッシュ

| 層 | 方式 | TTL | 認証サービスへのリクエスト |
|----|------|-----|-------------------------|
| L1 | Cookie キャッシュ (署名付き) | 5分 | 不要 |
| L2 | Redis セカンダリストレージ | セッション有効期限 | 不要（Redis 直接参照） |
| L3 | PostgreSQL | - | 必要（フォールバック） |

---

## モノレポ構成

```
/
├── apps/
│   ├── auth-service/          # 認証マイクロサービス（新規）
│   │   ├── src/
│   │   │   ├── index.ts       # Hono + ConnectRPC サーバー
│   │   │   ├── auth.ts        # Better Auth 設定（lib/auth.ts から移植）
│   │   │   ├── rpc/           # ConnectRPC ハンドラー
│   │   │   │   └── auth-handler.ts
│   │   │   ├── hooks/         # セッションフック
│   │   │   └── email/         # Resend 統合
│   │   ├── db/
│   │   │   ├── schema.ts      # 認証テーブル（user, session, account, verification, org）
│   │   │   └── client.ts      # Drizzle クライアント
│   │   ├── drizzle/           # マイグレーション
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── taimei/                # 既存プロジェクト（認証クライアント化）
│       └── ... (現在の構成)
│
├── packages/
│   ├── auth-proto/            # Proto 定義 + 生成コード（新規）
│   │   ├── proto/
│   │   │   └── auth/v1/auth.proto
│   │   ├── gen/               # Buf 生成コード
│   │   └── package.json
│   │
│   └── auth-client/           # 認証クライアント SDK（新規）
│       ├── src/
│       │   ├── server.ts      # ConnectRPC クライアント（サーバーサイド用）
│       │   ├── guard.ts       # verifySession / getSession ヘルパー
│       │   └── browser.ts     # Better Auth React クライアント（ブラウザ用）
│       └── package.json
│
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## Proto 定義（gRPC API）

```protobuf
// packages/auth-proto/proto/auth/v1/auth.proto
syntax = "proto3";
package auth.v1;

service AuthService {
  rpc VerifySession(VerifySessionRequest) returns (VerifySessionResponse);
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc FindAccountByUserId(FindAccountRequest) returns (FindAccountResponse);
  rpc SignOut(SignOutRequest) returns (SignOutResponse);
  rpc SendMagicLink(SendMagicLinkRequest) returns (SendMagicLinkResponse);
}

message VerifySessionRequest {
  string session_token = 1;
}

message VerifySessionResponse {
  optional User user = 1;
  optional Session session = 2;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
  optional string image = 4;
}

message Session {
  string id = 1;
  string token = 2;
  string expires_at = 3;
}
// ... 他のメッセージ定義
```

---

## 段階的移行計画

### Phase 1: 認証サービス Standalone 化

**目的**: Better Auth を Hono 上で独立動作させる

1. `apps/auth-service` を新規作成
2. `lib/auth.ts` の設定を移植（`nextCookies()` 除去、Hono adapter に差し替え）
3. 認証テーブル（user, session, account, verification）の Drizzle スキーマを移動
4. `crossSubDomainCookies` + `trustedOrigins` を設定
5. Redis セカンダリストレージを追加
6. Docker Compose に auth-service + auth-postgres + redis を追加
7. **検証**: 認証サービス単体で OAuth + Magic Link ログインが動作すること

**移植元ファイル:**
- `lib/auth.ts` → `apps/auth-service/src/auth.ts`
- `lib/email/` → `apps/auth-service/src/email/`
- `lib/auth/hooks/` → `apps/auth-service/src/hooks/`
- `db/drizzle/schema.ts`（認証テーブルのみ）→ `apps/auth-service/db/schema.ts`

### Phase 2: gRPC API + クライアント SDK

**目的**: 他プロダクトから認証サービスを利用できるようにする

1. `packages/auth-proto` に Proto 定義を作成
2. Buf でコード生成（ConnectRPC TypeScript）
3. `apps/auth-service/src/rpc/auth-handler.ts` に gRPC ハンドラーを実装
4. `packages/auth-client` にサーバーサイド SDK（ConnectRPC クライアント）を作成
5. `packages/auth-client` にブラウザ SDK（Better Auth React クライアントの薄いラッパー）を作成
6. **検証**: gRPC クライアントからセッション検証・ユーザー取得が動作すること

### Phase 3: taimei のクライアント移行

**目的**: taimei の認証を自前からマイクロサービス呼び出しに切り替える

1. `app/services/auth-service.ts` の内部実装を ConnectRPC クライアントに差し替え
   - `auth.api.getSession()` → `authClient.verifySession()`
   - `auth.api.signOut()` → `authClient.signOut()`
   - `auth.api.signInMagicLink()` → `authClient.sendMagicLink()`
   - PgDrizzle の `account` クエリ → `authClient.findAccountByUserId()`
2. `app/lib/auth-guard.ts` を `packages/auth-client/guard.ts` に差し替え
3. `lib/auth-client.ts` の `baseURL` を認証サービスに変更
4. `app/api/auth/[...all]/route.ts` を認証サービスへのプロキシ or 削除
5. `lib/auth.ts` を taimei から削除
6. DB スキーマから認証テーブルを除去、`userProfile.userId` の FK 制約を削除（論理参照に変更）
7. **検証**: taimei の全認証フロー（ログイン、ログアウト、セッション検証、プロフィール表示）が認証サービス経由で動作すること

### Phase 4: Organization + SSO プラグイン追加

**目的**: 招待・SSO 等のエンタープライズ機能を認証サービスに追加

1. Better Auth Organization プラグインを追加（招待/ロール/チーム）
2. SSO プラグイン（SAML/OIDC RP）を追加
3. Proto 定義に招待・組織管理の RPC を追加
4. クライアント SDK を拡張
5. **検証**: 招待フロー、SSO ログインが動作すること

---

## 主要な変更ファイル一覧

### 認証サービスに移動するファイル

| 移動元 (taimei) | 移動先 (auth-service) |
|-----------------|----------------------|
| `lib/auth.ts` | `apps/auth-service/src/auth.ts` |
| `lib/email/client.ts` | `apps/auth-service/src/email/client.ts` |
| `lib/email/send-welcome.ts` | `apps/auth-service/src/email/send-welcome.ts` |
| `lib/email/magic-link.tsx` | `apps/auth-service/src/email/magic-link.tsx` |
| `lib/auth/hooks/session-flash-hook.ts` | `apps/auth-service/src/hooks/session-flash-hook.ts` |
| `db/drizzle/schema.ts` (認証テーブルのみ) | `apps/auth-service/db/schema.ts` |

### taimei 側で書き換えるファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/services/auth-service.ts` | `auth.api.*` → ConnectRPC クライアント呼び出し |
| `app/services/index.ts` | `AuthService.Default` の Layer を PgDrizzleLive → ConnectRPC Layer に変更 |
| `app/lib/auth-guard.ts` | `auth.api.getSession()` → `packages/auth-client` の guard に差し替え |
| `app/lib/data.ts` | `fetchCurrentUser()` の `auth.api.getSession()` → auth-client 経由 |
| `lib/auth-client.ts` | `baseURL` を認証サービス URL に変更 |
| `app/api/auth/[...all]/route.ts` | 認証サービスへのプロキシ or 削除 |
| `db/drizzle/schema.ts` | 認証テーブル除去、`userProfile.userId` FK 削除 |

### taimei 側で変更不要なファイル

| ファイル | 理由 |
|---------|------|
| `app/dashboard/layout.tsx` | `verifySession()` のインターフェース不変 |
| `app/setting/layout.tsx` | 同上 |
| `components/auth/github-auth-button.tsx` | `authClient.signIn.social()` は `baseURL` 変更のみ |
| `components/auth/email-link-auth-form.tsx` | Server Action 経由のため変更不要 |
| `app/lib/actions.ts` | `AuthService` のインターフェース不変（DIP の恩恵） |

---

## リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Cookie ドメイン変更で既存セッション無効化 | 高 | 移行期間中は両ドメインの Cookie を並行発行 |
| 認証サービス SPOF | 高 | Cookie キャッシュ (5分) + Redis で認証サービスダウン時も継続動作 |
| `userProfile` FK 削除による整合性リスク | 中 | ユーザー削除時は Webhook でプロダクト側に通知し関連データ削除 |
| gRPC レイテンシ増加 | 中 | 3層キャッシュ戦略で大半のリクエストは認証サービスに到達しない |
| Better Auth OIDC Provider の成熟度 | 低 | Phase 4 で評価。必要なら Keycloak 等の併用を検討 |

---

## 検証計画

### Phase 1 検証
```bash
# 認証サービス単体起動
cd apps/auth-service && bun run dev

# GitHub OAuth ログインテスト（ブラウザ）
# → auth.taimei-code.com でログイン → Cookie が .taimei-code.com に設定されること

# Magic Link テスト
# → メール受信 → リンククリック → セッション作成
```

### Phase 2 検証
```bash
# gRPC クライアントテスト
cd packages/auth-client
bun vitest run

# ConnectRPC での VerifySession 呼び出し
# → セッションCookie を送信 → ユーザー情報が返ること
```

### Phase 3 検証
```bash
# taimei 全体テスト
cd apps/taimei
bun run test:db

# E2E テスト（auth-service + taimei を起動）
docker compose up --build
bun run e2e

# 手動検証チェックリスト:
# □ /auth ページでGitHub ログインできる
# □ /auth ページでMagic Link ログインできる
# □ /dashboard にセッション検証後アクセスできる
# □ /setting にセッション検証後アクセスできる
# □ ログアウト後に / にリダイレクトされる
# □ プロフィール更新が動作する
# □ 未認証で /dashboard にアクセスすると /auth にリダイレクトされる
```
