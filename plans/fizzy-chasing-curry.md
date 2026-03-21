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
| リポ構成 | **別リポ** | 認証サービスを独立リポジトリ化。SDK は npm パッケージとして公開 |

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

## リポジトリ構成（別リポ方式）

認証サービスを独立リポジトリとして構築し、クライアント SDK を npm パッケージとして公開する。

```
# リポ: taimei-auth（新規作成）
taimei-auth/
├── src/
│   ├── index.ts               # Hono + ConnectRPC サーバー
│   ├── auth.ts                # Better Auth 設定（taimei の lib/auth.ts から移植）
│   ├── rpc/                   # ConnectRPC ハンドラー
│   │   ├── auth-handler.ts
│   │   └── user-handler.ts
│   ├── hooks/                 # セッションフック
│   └── email/                 # Resend 統合
├── db/
│   ├── schema.ts              # 認証テーブル（user, session, account, verification）
│   └── client.ts              # Drizzle クライアント
├── drizzle/                   # マイグレーション
├── proto/
│   └── auth/v1/auth.proto     # Proto 定義
├── packages/
│   └── auth-client/           # クライアント SDK（npm publish）
│       ├── src/
│       │   ├── server.ts      # ConnectRPC クライアント（サーバーサイド用）
│       │   ├── guard.ts       # verifySession / getSession ヘルパー
│       │   └── browser.ts     # Better Auth React クライアント（ブラウザ用）
│       └── package.json
├── docker-compose.yml
├── Dockerfile
└── package.json

# リポ: taimei（既存）
taimei/
├── package.json               # "@taimei/auth-client": "^0.1.0" を追加
└── ... (現在の構成、turbo.json や workspaces は不要)
```

**利点**: 認証サービスが独立デプロイ可能。新プロダクトは `npm install @taimei/auth-client` で認証基盤を利用できる

---

## Proto 定義（gRPC API）

```protobuf
// packages/auth-proto/proto/auth/v1/auth.proto
syntax = "proto3";
package auth.v1;

// 認証（セッション管理、OAuth、Magic Link）
service AuthService {
  rpc VerifySession(VerifySessionRequest) returns (VerifySessionResponse);
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc FindAccountByUserId(FindAccountRequest) returns (FindAccountResponse);
  rpc SignOut(SignOutRequest) returns (SignOutResponse);
  rpc SendMagicLink(SendMagicLinkRequest) returns (SendMagicLinkResponse);
}

// ユーザー管理（user テーブルが auth-service DB に移動するため必要）
service UserService {
  rpc FindUserByEmail(FindUserByEmailRequest) returns (FindUserByEmailResponse);
  rpc FindUserById(FindUserByIdRequest) returns (FindUserByIdResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
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
5. Hono CORS middleware を追加（`trustedOrigins` は CSRF 保護のみ。CORS には `hono/cors` + `credentials: true` が別途必要）
6. サービス間認証: ConnectRPC リクエストに API Key ヘッダー（`X-Service-Key`）を付与・検証
7. Redis セカンダリストレージを追加
8. Docker Compose に auth-service + auth-postgres + redis を追加
9. **検証**: 認証サービス単体で OAuth + Magic Link ログインが動作すること。Cookie Domain=`.taimei-code.com` を DevTools で確認

**移植元ファイル:**
- `lib/auth.ts` → `apps/auth-service/src/auth.ts`
- `lib/email/` → `apps/auth-service/src/email/`
- `db/drizzle/schema.ts`（認証テーブルのみ）→ `apps/auth-service/db/schema.ts`

**⚠️ setFlash は移植しない:**
`lib/auth/hooks/session-flash-hook.ts` は Next.js `cookies()` 依存のため auth-service に移植不可。auth-service はリダイレクト URL にクエリパラメータ（`?auth_event=signup|login`）を付与し、taimei 側で受け取って `setFlash()` する方式に変更

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

1. **[原子的変更]** サービス層の ConnectRPC 移行（auth-service.ts + user-service.ts + index.ts を同時変更）
   - `app/services/auth-service.ts`: `auth.api.*` → ConnectRPC AuthService クライアント
   - `app/services/user-service.ts`: PgDrizzle `user` テーブル → ConnectRPC UserService クライアント（existsByEmail は findUserByEmail null 判定で代替、clearImage は updateUser image=null で代替）
   - `app/services/index.ts`: AuthService + UserService の Layer を ConnectRPC Layer に変更。AccountValidationService は UserService 経由で連鎖解決
2. `app/lib/auth-guard.ts` を `packages/auth-client/guard.ts` に差し替え（gRPC エラー → AuthServiceUnavailable / AuthServiceTimeout TaggedError にマッピング）
3. `app/lib/data.ts`: `fetchCurrentUser()` を `cache()` 付き `verifySession()` の戻り値から導出に変更（二重 RPC 回避）
4. `app/lib/actions.ts`: `deleteUser()` を auth-service DeleteUser RPC 経由に変更（UserService.delete() は user テーブル直接アクセスのため動作不能）
5. `lib/auth-client.ts` の `baseURL` を認証サービスに変更
6. `app/api/auth/[...all]/route.ts` を削除（ブラウザは auth.taimei-code.com に直接アクセス。CORS は Hono middleware で処理）
7. `lib/auth.ts` を taimei から削除
8. DB スキーマから認証テーブルを除去、`userProfile.userId` の FK 制約を削除（論理参照に変更）
9. E2E テスト基盤更新: `e2e/tests/utils/signIn.ts` の DB 接続先を auth-service DB に変更
10. **検証**: taimei の全認証フロー（ログイン、ログアウト、セッション検証、プロフィール表示、ユーザー削除）が認証サービス経由で動作すること

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
| ~~`lib/auth/hooks/session-flash-hook.ts`~~ | taimei 側に残留（Next.js `cookies()` 依存のため移植不可） |
| `db/drizzle/schema.ts` (認証テーブルのみ) | `apps/auth-service/db/schema.ts` |

### taimei 側で書き換えるファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/services/auth-service.ts` | `auth.api.*` → ConnectRPC AuthService クライアント |
| `app/services/user-service.ts` | PgDrizzle `user` テーブル → ConnectRPC UserService クライアント（4 RPC） |
| `app/services/index.ts` | AuthService + UserService の Layer を ConnectRPC Layer に変更 |
| `app/lib/auth-guard.ts` | `auth.api.getSession()` → `packages/auth-client/guard.ts`（インフラ TaggedError マッピング含む） |
| `app/lib/data.ts` | `fetchCurrentUser()` を `cache()` 付き `verifySession()` 戻り値から導出に変更 |
| `app/lib/actions.ts` | `deleteUser()` を auth-service DeleteUser RPC 経由に変更。signOut/sendAuthEmailLink は不変 |
| `lib/auth-client.ts` | `baseURL` を認証サービス URL に変更 |
| `app/api/auth/[...all]/route.ts` | 削除（CORS は auth-service Hono middleware で処理） |
| `db/drizzle/schema.ts` | 認証テーブル除去、`userProfile.userId` FK 削除 |
| `e2e/tests/utils/signIn.ts` | DB 接続先を auth-service DB に変更 |

### taimei 側で変更不要なファイル

| ファイル | 理由 |
|---------|------|
| `app/dashboard/layout.tsx` | `verifySession()` のインターフェース不変 |
| `app/setting/layout.tsx` | 同上 |
| `components/auth/github-auth-button.tsx` | `authClient.signIn.social()` は `baseURL` 変更のみ |
| `components/auth/email-link-auth-form.tsx` | Server Action 経由のため変更不要 |

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

---

## 品質検証

- AC: 3観点×4カテゴリ = 33項目定義済み → fizzy-chasing-curry.analysis.md
- 技術リスク: 3件特定済み → fizzy-chasing-curry.analysis.md
- MECE判定: 要修正（Critical 4件） / ACカバレッジ 26/33項目 → fizzy-chasing-curry.analysis.md
- 設計レビュー: Critical 2件追加（CORS欠落, サービス間認証未設計） / Important 5件 → fizzy-chasing-curry.analysis.md

---

## 実装準備

### ブランチ戦略

**taimei-auth リポ（新規）**: `main` ブランチで直接開発（Phase 1-2）
**taimei リポ（既存）**: `feature/micro-auth/client-migration` ブランチ（Phase 3）

### PR分割計画

**taimei-auth リポ（Phase 1-2）:**

| PR | スコープ | ファイル数 | 依存 |
|----|----------|-----------|------|
| PR1 | リポ初期化 + DB スキーマ + Better Auth 設定 | 5 | - |
| PR2 | Hono サーバー + CORS + API Key + Docker Compose | 5 | PR1 |
| PR3 | Redis + ヘルスチェック | 3 | PR2 |
| PR4 | Proto 定義 + Buf コード生成 | 5 | PR1 |
| PR5 | gRPC ハンドラー実装 | 4 | PR2, PR4 |
| PR6 | auth-client SDK（npm パッケージ） | 5 | PR4 |

**taimei リポ（Phase 3）:**

| PR | スコープ | ファイル数 | 依存 |
|----|----------|-----------|------|
| PR7 | **[原子的]** Service 層 ConnectRPC 移行 | 3 | PR5, PR6 |
| PR8 | auth-guard + data.ts + エラー拡張 | 4 | PR7 |
| PR9 | actions.ts deleteUser + auth-client インストール | 3 | PR7 |
| PR10 | API Route 削除 + lib/auth.ts 削除 | 3 | PR8, PR9 |
| PR11 | DB スキーマ認証テーブル除去 + FK 削除 | 4 | PR10 |
| PR12 | E2E テスト基盤更新 | 2 | PR11 |

**PRチェーン図**:
```
taimei-auth リポ:
  PR1 (init + schema + auth)
    ├── PR2 → PR3              (Hono + Docker + Redis)
    │           └── PR5 ←─┐   (gRPC ハンドラー)
    └── PR4 ───────────────┤   (Proto、並行可)
          └── PR6          │   (auth-client SDK → npm publish)

taimei リポ:
  PR7 (Service層移行) → PR8 → PR9 → PR10 → PR11 → PR12
```

### 手動QA手順

**環境**: Docker Compose（localhost:3000=taimei, localhost:3100=auth-service）
**対象AC**: 42項目中22項目を手動QA、20項目を自動テストに委任

#### 正常系（9件）

| ID | 手順 | 期待結果 |
|----|------|---------|
| QA-H-01 | /auth → GitHub OAuth ボタン → 認可 | /dashboard リダイレクト、Cookie Domain=.taimei-code.com |
| QA-H-02 | /auth → メール入力 → Magic Link → リンククリック | /dashboard、フラッシュ「ログインしました」 |
| QA-H-03 | 認証済み → /dashboard | 200 OK、コンテンツ表示 |
| QA-H-04 | ログアウトボタン | / リダイレクト、Cookie 削除、フラッシュ表示 |
| QA-H-05 | 未登録メールで Magic Link | フラッシュ「アカウントを作成しました」、ウェルカムメール |
| QA-H-06 | ?auth_event=signup でリダイレクト | taimei 側でフラッシュ表示 |
| QA-H-07 | ?auth_event=login でリダイレクト | taimei 側でフラッシュ表示 |
| QA-H-08 | /setting プロフィール更新 | bio 保存・表示正常 |
| QA-H-09 | /dashboard invoices/customers 表示 | 変更前と同一 |

#### 異常系（4件）

| ID | 手順 | 期待結果 |
|----|------|---------|
| QA-E-01 | Cookie 削除後 /dashboard | /auth リダイレクト（302） |
| QA-E-02 | 期限切れ Magic Link クリック | /auth、エラートースト |
| QA-E-03 | GitHub OAuth Cancel | /auth、エラーメッセージ |
| QA-E-04 | DevTools で Cookie 値改竄 → /dashboard | /auth リダイレクト |

#### 非影響確認（6件）+ MECE追加（3件）

| ID | 確認内容 |
|----|---------|
| QA-R-01 | dashboard/setting layout が verifySession() で正常動作 |
| QA-R-02 | signOut/sendAuthEmailLink Server Action 正常 |
| QA-R-03 | GitHub ボタン + Magic Link フォーム正常 |
| QA-R-04 | useCurrentUser の useSession() 正常 |
| QA-R-05 | ビジネスサービス・テーブル CRUD 不変 |
| QA-R-06 | CORS: auth.taimei-code.com への fetch が credentials 付きで成功 |
| QA-M-01 | setting/profile update/clearImage が ConnectRPC 経由で正常 |
| QA-M-02 | deleteUser が auth-service DeleteUser RPC → Webhook で userProfile 削除 |
| QA-M-03 | fetchCurrentUser が二重 RPC を発行していない（DevTools Network タブ確認） |

### 自動QA（テストコード仕様）

#### auth-service RPC テスト（新規）

**ファイル**: `apps/auth-service/__tests__/rpc.test.ts`

```typescript
describe("AuthService RPC", () => {
  it("VerifySession: 有効トークン → User + Session")
  it("VerifySession: 無効トークン → null")
  it("SignOut: セッション無効化")
  it("SendMagicLink: メール送信成功")
  it("FindAccountByUserId: Account 返却")
})

describe("UserService RPC", () => {
  it("FindUserByEmail: 存在する → User")
  it("FindUserByEmail: 存在しない → null")
  it("FindUserById: User 返却")
  it("UpdateUser: 更新後 User 返却")
  it("DeleteUser: 削除成功")
})
```

#### auth-client テスト（新規）

**ファイル**: `packages/auth-client/__tests__/server.test.ts`

```typescript
describe("ConnectRPC Client", () => {
  it("正常: VerifySession → User + Session")
  it("異常: サービスダウン → AuthServiceUnavailable")
  it("異常: タイムアウト → AuthServiceTimeout")
  it("異常: 接続拒否 → AuthServiceUnavailable")
  it("API Key なし → UNAUTHENTICATED")
})
```

#### taimei サービス層テスト（書き換え）

**ファイル**: `app/services/__tests__/auth-service.test.ts`
**パターン**: `new AuthService({...})` モック維持、内部を ConnectRPC に変更

```typescript
describe("AuthService (ConnectRPC)", () => {
  it("getSession: VerifySession RPC → セッション返却")
  it("signOut: SignOut RPC → 成功")
  it("sendMagicLink: SendMagicLink RPC → 成功")
  it("findAccountByUserId: FindAccountByUserId RPC → Account")
})
```

**ファイル**: `app/services/__tests__/user-service.test.ts`

```typescript
describe("UserService (ConnectRPC)", () => {
  it("existsByEmail: FindUserByEmail null 判定")
  it("findByEmail/findById: User 返却")
  it("update: UpdateUser → 更新後 User")
  it("delete: DeleteUser → 成功")
  it("clearImage: UpdateUser image=null → 成功")
})
```

#### 既存テスト実行（非影響確認）

```bash
bun vitest run                    # 全ユニットテスト
bun run test:db                   # DB 統合テスト
docker compose -f docker-compose.e2e.yml up --build  # E2E
```

#### ACカバレッジ

| カテゴリ | 合計 | 手動QA | 自動テスト | カバー率 |
|---------|------|--------|-----------|---------|
| 正常系 | 11 | 7 | 4 | 100% |
| 異常系 | 10 | 4 | 6 | 100% |
| エッジケース | 8 | 0 | 8 | 100% |
| 非影響確認 | 9 | 5 | 4 | 100% |
| MECE追加 | 6 | 3 | 3 | 100% |
| 設計レビュー追加 | 3 | 1 | 2 | 100% |
| **合計** | **47** | **20** | **27** | **100%** |

---

## 実装ログ

### PR1 (taimei-auth): リポ初期化 + DB スキーマ + Better Auth 設定 — 完了 ✅

**リポジトリ**: https://github.com/YasuakiOmokawa/taimei-auth (public)
**コミット**: `5d2fbf3`
**作成ファイル (12件)**:
- `package.json` / `tsconfig.json` / `.gitignore` — パッケージ初期化
- `db/schema.ts` — 認証テーブル 4つ（user, session, account, verification）+ relations
- `db/client.ts` — Drizzle クライアント（`DATABASE_URL`）
- `src/auth.ts` — Better Auth 設定（nextCookies 除去, crossSubDomainCookies, trustedOrigins 環境変数化, setFlash→クエリパラメータ方式）
- `src/index.ts` — Hono エントリポイント（`/api/auth/**` + `/health`）
- `src/email/client.ts` — Resend クライアント
- `src/email/magic-link.tsx` / `src/email/welcome.tsx` — メールテンプレート
- `src/email/send-welcome.ts` — ウェルカムメール送信

**設計変更**: モノレポ → 別リポ方式に変更。taimei の turbo.json / workspaces は不要に

### 付随修正 (taimei): tsconfig.json に e2e を exclude — 完了 ✅

**コミット**: `8e4af4e`
**理由**: Vercel ビルドで e2e/playwright.config.ts が @playwright/test を import し型エラー。E2E はビルド対象外のため exclude

### PR2 (taimei-auth): CORS + サービス間認証 + Docker Compose — 完了 ✅

**コミット**: `e41d6bb`
**変更ファイル (4件)**:
- `src/index.ts` — CORS middleware（`hono/cors`, `credentials: true`, 許可オリジン環境変数化）+ API Key 検証 middleware（`/rpc/*` のみ）
- `Dockerfile` — Bun ベース、マルチステージビルド
- `docker-compose.yml` — auth-service(3100) + auth-postgres(5435)、ホットリロード対応
- `.dockerignore`

**設計判断**:
- API Key は `/rpc/*` のみ適用。`/api/auth/**` はブラウザから直接呼ばれるため除外
- ローカル開発時は `AUTH_COOKIE_DOMAIN: localhost`（サブドメイン共有不要）

### PR3 (taimei-auth): Redis セカンダリストレージ + ヘルスチェック — 完了 ✅

**コミット**: `8e04363`
**変更ファイル (4件 + lockfile)**:
- `src/redis.ts` — Redis クライアント + Better Auth secondaryStorage アダプター（get/set/delete）
- `src/auth.ts` — `secondaryStorage: redisStorage` 追加
- `src/index.ts` — Redis 接続 + `/health` に DB・Redis 疎通チェック（200 ok / 503 degraded）
- `docker-compose.yml` — auth-redis サービス追加（redis:7-alpine, ポート 6380）

**3層キャッシュ完成**: L1 Cookie キャッシュ（5分）+ L2 Redis secondaryStorage + L3 PostgreSQL
