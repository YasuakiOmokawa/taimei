## 受け入れ条件

### 検討観点
- 認証状態（未認証/認証済み/セッション期限切れ）: マイクロサービス化後も全認証フローの正常動作を保証する必要があるため
- サービス間通信（認証サービス正常/ダウン/高レイテンシ）: ネットワーク依存が新たに発生し信頼性検証が必要なため
- DB分離（認証DB/プロダクトDB/データ整合性）: 単一DBから2DB構成への移行に伴うFK削除と整合性保証方式の変更を検証する必要があるため

### 正常系

**認証状態:**
- [ ] 未認証ユーザーが /auth で GitHub OAuth → auth.taimei-code.com 経由で認証 → Cookie（Domain=.taimei-code.com）発行 → /dashboard にリダイレクト
- [ ] 未認証ユーザーが /auth で Magic Link → Resend 経由でメール受信 → リンククリック → Cookie 発行 → フラッシュ「ログインしました」表示
- [ ] 認証済みユーザーが /dashboard → verifySession() が ConnectRPC VerifySession RPC → 200 OK
- [ ] ログアウト → ConnectRPC SignOut RPC → Cookie 削除 → / にリダイレクト → フラッシュ表示
- [ ] 新規ユーザー初回ログイン → auth-service DB に user 作成 → ウェルカムメール送信

**サービス間通信:**
- [ ] taimei → VerifySession RPC → session_token 送信 → User + Session メッセージ返却
- [ ] taimei → FindAccountByUserId RPC → user_id 送信 → Account 情報返却
- [ ] taimei → SendMagicLink RPC → email + callbackURL 送信 → メール送信成功

**DB分離:**
- [ ] auth-service DB に user/session/account/verification テーブルが存在し CRUD 正常動作
- [ ] taimei DB に userProfile テーブルが存在し userId（論理参照、FK なし）で関連付け CRUD 動作
- [ ] taimei DB の customers/invoices/tags テーブルの CRUD が変更前と完全に同一

### 異常系

**認証状態:**
- [ ] 無効なセッショントークンで /dashboard → /auth?callbackUrl=%2Fdashboard にリダイレクト（302）
- [ ] 期限切れ Magic Link（5分超過）→ /auth にリダイレクト → トースト「MAGIC_LINK_EXPIRED」相当
- [ ] GitHub OAuth 認可拒否（Cancel）→ /auth にリダイレクト → エラーメッセージ表示
- [ ] 存在しないトークンで VerifySession RPC → user=null, session=null

**サービス間通信:**
- [ ] 認証サービスダウン中に VerifySession → ConnectRPC UNAVAILABLE → taimei 側でエラーハンドリング
- [ ] gRPC タイムアウト → DEADLINE_EXCEEDED → taimei 側でエラーハンドリング
- [ ] 接続拒否（ポート不一致）→ ConnectRPC エラー → SessionError 返却

**DB分離:**
- [ ] auth-service DB で user 削除 → Webhook → taimei の userProfile カスケード削除
- [ ] Webhook 配信失敗 → DLQ 蓄積 → 定期バッチ再処理 → 最終的に userProfile 削除
- [ ] auth-service DB 接続不可 → Better Auth 起動失敗 → ヘルスチェック検知

### エッジケース（境界値チェックリストより）

**認証状態:**
- [ ] 状態（Cookie キャッシュ）: キャッシュ有効期間内（5分以内）→ RPC なしで Cookie から直接検証成功
- [ ] 状態（キャッシュ境界）: キャッシュ期限直後 → Redis（L2）フォールバックで検証成功
- [ ] 同時（複数プロダクト）: app1 と app2 に同時ログイン中、app1 からログアウト → 共有 Cookie 削除 → app2 も未認証
- [ ] 同時（二重ログイン）: 別ブラウザからログイン → 両方にセッション発行（Better Auth デフォルト）
- [ ] 状態（Account Linking）: GitHub 登録済みメールで Magic Link → accountLinking により同一ユーザーに紐付

**サービス間通信:**
- [ ] 状態（再起動中）: 認証サービス再起動中 → Cookie キャッシュ（L1、5分）で継続動作
- [ ] 数値（大量リクエスト）: 100件同時セッション検証 → Redis（L2）処理
- [ ] 状態（接続アイドル）: ConnectRPC 接続が長時間アイドル後 → 自動再接続で正常動作

**DB分離:**
- [ ] 数値（0件）: auth-service DB の user テーブル空 → 新規登録正常動作
- [ ] 状態（マイグレーション）: 既存認証データを taimei DB → auth-service DB に移行 → 全レコード正確に移行
- [ ] 状態（孤立レコード）: auth-service に user 不在 + taimei に userProfile 残存 → アプリ層で検出・エラーハンドリング

### 非影響確認

- [ ] `app/dashboard/layout.tsx` の `verifySession()` が変更前と同じインターフェースで動作
- [ ] `app/setting/layout.tsx` の `verifySession()` が変更前と同じインターフェースで動作
- [ ] `app/lib/actions.ts` の `signOut()`/`sendAuthEmailLink()` が AuthService インターフェース不変で動作
- [ ] `components/auth/github-auth-button.tsx` が `signIn.social()` で baseURL 変更のみで動作
- [ ] `components/auth/email-link-auth-form.tsx` が Server Action 経由で変更なく動作
- [ ] `app/lib/hooks/useCurrentUser.ts` の `useSession()` が baseURL 変更のみで動作
- [ ] InvoiceService / CustomerService / DashboardService / Tag2Service が taimei DB 内で正常動作
- [ ] customers / invoices / tags / tags2 / revenue テーブルの CRUD が変更前と同一
- [ ] `app/services/index.ts` の Live Layer で AuthService 以外のサービス Layer 構成が不変

## 技術リスク

### リスク1: Hono + ConnectRPC の同一ポート共存
- **何がわからないか**: Hono middleware として ConnectRPC を同一ポートに載せた際に Better Auth の HTTP ルートと競合するか不明。
- **最悪何が起きるか**: gRPC エンドポイントが動作せず全プロダクトのセッション検証が失敗しログイン不能になる。
- **どうやって検証するか**: Phase 1 で最小構成（Hono + ConnectRPC + Better Auth `/api/auth/session` のみ）のスパイクを実施し `buf curl` で VerifySession RPC 疎通確認。

### リスク2: crossSubDomainCookies の Hono 上での動作
- **何がわからないか**: Better Auth の crossSubDomainCookies が nextCookies() プラグインなしの Hono 環境で Cookie Domain 属性を .taimei-code.com に設定するか不明。
- **最悪何が起きるか**: Cookie が auth.taimei-code.com にのみ設定されプロダクト間でセッション共有できず全認証が機能しない。
- **どうやって検証するか**: Phase 1 で auth.taimei-code.com にログイン後、DevTools > Application > Cookies で Domain=`.taimei-code.com` を目視確認。

### リスク3: userProfile FK 削除後のデータ整合性
- **何がわからないか**: Webhook 非同期削除で auth-service の user 削除と taimei の userProfile 削除の間の不整合ウィンドウの長さが不明。
- **最悪何が起きるか**: ユーザー削除後も userProfile が残存し存在しないユーザーのプロフィールが表示される。
- **どうやって検証するか**: Phase 3 で auth-service API から user 削除 → taimei の `fetchCurrentUser()` → userProfile 存在確認 → Webhook 到達後に削除を確認。

## MECE分析結果

### 分析サマリー
- 分析日時: 2026-03-21
- 対象リポジトリ: YasuakiOmokawa/taimei
- ACカバレッジ: 26/33項目充足（7項目に問題あり）
- 判定: 要修正（Critical 4件）

### ACカバレッジ検証結果

| # | AC項目 | カテゴリ | QA検証 | Tech検証 | 総合判定 |
|---|--------|---------|--------|---------|---------|
| 1 | GitHub OAuth→Cookie→/dashboard | 正常系 | ✅ | ✅ | 充足 |
| 2 | Magic Link→Cookie→フラッシュ | 正常系 | ❌ | ❌ | 不十分（setFlash Hono非互換） |
| 3 | /dashboard→VerifySession→200 | 正常系 | ✅ | ✅ | 充足 |
| 4 | ログアウト→SignOut→Cookie削除→フラッシュ | 正常系 | ❌ | ❌ | 不十分（setFlash Hono非互換） |
| 5 | 新規ユーザー→user作成→ウェルカムメール | 正常系 | ✅ | ✅ | 充足 |
| 6 | VerifySession RPC→User+Session | 正常系 | ✅ | ✅ | 充足 |
| 7 | FindAccountByUserId RPC→Account | 正常系 | ✅ | ✅ | 充足 |
| 8 | SendMagicLink RPC→メール送信 | 正常系 | ✅ | ✅ | 充足 |
| 9 | auth-service DB CRUD正常 | 正常系 | ✅ | ✅ | 充足 |
| 10 | userProfile論理参照CRUD | 正常系 | ✅ | ✅ | 充足 |
| 11 | ビジネステーブルCRUD不変 | 正常系 | ✅ | ✅ | 充足 |
| 12 | 無効トークン→302 | 異常系 | ✅ | ✅ | 充足 |
| 13 | 期限切れMagicLink→エラー | 異常系 | ✅ | ✅ | 充足 |
| 14 | OAuth拒否→エラー | 異常系 | ✅ | ✅ | 充足 |
| 15 | 存在しないトークン→null | 異常系 | ✅ | ✅ | 充足 |
| 16 | サービスダウン→UNAVAILABLE | 異常系 | ✅ | ✅ | 充足 |
| 17 | タイムアウト→DEADLINE_EXCEEDED | 異常系 | ✅ | ✅ | 充足 |
| 18 | 接続拒否→SessionError | 異常系 | ✅ | ✅ | 充足 |
| 19 | user削除→Webhook→userProfile削除 | 異常系 | ❌ | ❌ | 不十分（Webhook/DLQ未設計） |
| 20 | Webhook失敗→DLQ→バッチ | 異常系 | ❌ | ❌ | 不十分（DLQ技術未選定） |
| 21 | DB接続不可→ヘルスチェック | 異常系 | ✅ | ✅ | 充足 |
| 22-29 | エッジケース8項目 | エッジ | ✅ | ✅ | 充足 |
| 30 | actions.ts signOut/sendAuthEmailLink不変 | 非影響 | ✅ | ❌ | 不十分（deleteUserが変更必要） |
| 31 | ビジネスサービス不変 | 非影響 | ✅ | ❌ | 不十分（UserServiceはuser依存） |
| 32 | Live Layer構成不変 | 非影響 | ✅ | ❌ | 不十分（UserServiceLive要変更） |
| 33 | その他非影響確認 | 非影響 | ✅ | ✅ | 充足 |

#### MECE分析によるAC追加提案
- [ ] `[MECE追加]` UserService の全メソッド（existsByEmail, findByEmail, findById, update, delete, clearImage）が ConnectRPC 経由で auth-service DB に正常アクセスできること
- [ ] `[MECE追加]` AccountValidationService が UserService（ConnectRPC 経由）で email 重複チェックが正常動作すること
- [ ] `[MECE追加]` auth-service の認証成功後リダイレクトでフラッシュメッセージの代替手段（クエリパラメータ等）が動作すること
- [ ] `[MECE追加]` deleteUser() が auth-service API 経由で user 削除 → Webhook で userProfile 削除のフローで動作すること
- [ ] `[MECE追加]` setting/profile の update()/clearImage() が ConnectRPC 経由の UserService で正常動作すること
- [ ] `[MECE追加]` E2E テストが auth-service DB 経由でテストユーザー作成・トークン取得を行い正常動作すること

#### 既存ACの修正提案
- 非影響確認「actions.ts の signOut()/sendAuthEmailLink() が不変」→ **signOut()/sendAuthEmailLink() は不変だが、deleteUser() は変更が必要**。AC を分離すべき
- 非影響確認「InvoiceService/CustomerService/DashboardService/Tag2Service が不変」→ **UserService は user テーブル依存のため影響を受ける**。UserService を除外すべき
- 非影響確認「Live Layer 構成が AuthService 以外不変」→ **UserServiceLive も変更が必要**。AuthService + UserService 以外に限定すべき

### Critical指摘（要修正）

| # | 指摘 | プラン該当箇所 | 推奨修正内容 | 根拠 | 合意状況 |
|---|------|--------------|------------|------|---------|
| 1 | UserService が user テーブルを6メソッドで直接クエリ → プランの変更ファイル一覧・Proto定義に未記載 | Proto定義セクション: AuthService のみ5 RPC / Phase 3: user-service.ts 未記載 / 変更ファイル一覧: user-service.ts 未記載 | Proto に UserService RPC（FindUserByEmail, FindUserById, UpdateUser, DeleteUser）を追加。Phase 3 変更ファイルに user-service.ts, index.ts の Layer 再構成を追加 | Tech C-1: user-service.ts が `user` from `@/db/drizzle/schema` を import | Tech 単独発見 |
| 2 | setFlash() が Next.js cookies() 依存 → Hono 上で動作不可 | Phase 1 移植元ファイル: `lib/auth/hooks/` → `apps/auth-service/src/hooks/` | session-flash-hook.ts は taimei 側に残留。auth-service はリダイレクト URL にクエリパラメータ（?auth_event=signup/login）を付与する方式に変更 | QA C-1 + Tech C-3: lib/flash-toaster.tsx が `(await cookies()).set()` 使用 | QA+Tech 合意 |
| 3 | actions.ts の deleteUser() が UserService.delete() を呼出 → 「変更不要」は誤り | 変更不要ファイル: `actions.ts AuthServiceインターフェース不変（DIPの恩恵）` | actions.ts を「書き換え」に移動。deleteUser() フローを auth-service API 経由に変更。Proto に DeleteUser RPC を追加 | QA C-3 + Tech C-2: actions.ts:201 が `UserService` を使用 | QA+Tech 合意 |
| 4 | Webhook/DLQ の実装技術が完全に未定義 | リスクと対策: 「Webhook でプロダクト側に通知し関連データ削除」 | Webhook の送信元（auth-service hooks）、受信側（taimei API Route）、DLQ 実装（Redis or PostgreSQL）、リトライポリシーを Phase 3 に具体的に記載 | QA C-2: コードベースに Webhook/DLQ の実装が一切存在しない | QA 単独発見 |

### Important/Nice-to-have

| # | 重要度 | 指摘 | 推奨対応 | 根拠 | 合意状況 |
|---|--------|------|---------|------|---------|
| 1 | 🟡 | E2E テストが taimei DB の user/verification に直接アクセス | e2e/tests/utils/signIn.ts の DB 接続先変更を Phase 3 に追加 | Tech I-4 | Tech 単独 |
| 2 | 🟡 | AccountValidationService が UserService 経由で user テーブルに間接依存 | index.ts の Layer 再構成で連鎖解決することを明記 | Tech I-5 | Tech 単独 |
| 3 | 🟡 | fetchCurrentUser() と verifySession() で二重 RPC の可能性 | fetchCurrentUser() を verifySession() 戻り値から取得、または cache() で重複排除 | QA I相当 | QA 単独 |
| 4 | 🟡 | setting/profile/actions.ts の update()/clearImage() も UserService 経由で user テーブルにアクセス | 変更ファイル一覧に追加 | Tech C-2 関連 | Tech 単独 |
| 5 | 🟢 | Proto の User メッセージに emailVerified フィールドがない | `bool email_verified = 5` を追加 | QA | QA 単独 |
| 6 | 🟢 | API Route の「プロキシ or 削除」が未決定 | 方式を1つに確定する | Red Team 事前分析 | 事前分析 |

### Red Teamレビューサマリー
<details>
<summary>Red Teamの攻撃と応答</summary>

#### 検出された責任の継ぎ目
| # | 領域 | QAの対応 | Techの対応 | 結論 |
|---|------|---------|----------|------|
| 1 | UserService の移行方針 | 間接的にのみ言及 | Critical-1 で詳細指摘 | Tech が発見。プランに完全欠落 |
| 2 | Webhook/DLQ 技術選定 | Critical-2 で指摘 | Important レベル | QA がより強く指摘。技術選定が必要 |
| 3 | CORS/SameSite 属性 | 未言及 | 未言及 | お見合い。Phase 1 検証項目に追加推奨 |

#### クロスリファレンス結果
| # | 分析対象 | 検証内容 | 発見事項 | 結論 |
|---|---------|---------|---------|------|
| 1 | setFlash | QA C-1 vs Tech C-3 | 同一根拠・同一結論 | 真の合意 |
| 2 | deleteUser | QA C-3 vs Tech C-2 | 同一根拠・同一結論 | 真の合意 |
| 3 | UserService | QA 間接 vs Tech C-1 | Tech がコード精読で発見 | Tech の指摘を採用 |
| 4 | CORS/SameSite | 両者未言及 | お見合い | Phase 1 検証に追加推奨 |
</details>

### 各ロール分析詳細
<details>
<summary>QA Analyst分析結果</summary>
Critical 3件: setFlash Hono非互換、Webhook/DLQ未設計、deleteUser変更不要は誤り
Important 3件: DIP迂回、Proto DeleteUser欠落、非影響確認不正確
ACカバレッジ: 52%（17/33）がコード/テストで裏付けあり
</details>

<details>
<summary>Tech Analyst分析結果</summary>
Critical 3件: UserService 6メソッド移行漏れ、deleteUser変更不要は誤り、setFlash Hono非互換
Important 4件: E2Eテスト基盤、AccountValidationService間接依存、Proto RPC不足、fetchCurrentUser戻り値型
</details>

<details>
<summary>Red Team統合評価レポート</summary>
分析品質: 高（両アナリストがコードレベルで裏取り実施）
Critical 4件（重複排除後）: UserService移行漏れ、setFlash非互換、deleteUser変更必要、Webhook未設計
お見合い 1件: CORS/SameSite属性
</details>

## 設計レビュー結果（/simplify + /vercel-react-best-practices + /react-doctor）

### 新規 Critical（MECE 分析の C1-C4 に追加）

| # | 指摘 | プラン該当箇所 | 推奨修正内容 | 根拠 |
|---|------|--------------|------------|------|
| C-5 | CORS middleware がプランに完全欠落。trustedOrigins は CSRF 保護であり CORS ヘッダーではない | Cookie ドメイン共有設計 / Phase 1 | auth-service に `hono/cors` middleware（`credentials: true`, 許可オリジン明示）を Phase 1 に追加 | authClient.useSession() が auth.taimei-code.com への cross-origin fetch になる |
| C-6 | ConnectRPC サービス間認証が未設計。任意のクライアントが RPC を呼べる | Phase 2: gRPC API | API Key ヘッダー（X-Service-Key）+ 内部ネットワーク制限を Phase 2 に追加 | VerifySession 等が認証なしで呼べるとセッション情報漏洩 |

### 新規 Important

| # | 重要度 | 指摘 | 推奨対応 | 根拠 |
|---|--------|------|---------|------|
| I-7 | 🟡→🔴 | fetchCurrentUser() の二重 RPC（MECE I-3 から格上げ） | fetchCurrentUser() 内部で cache() 付き verifySession() を呼ぶ方式に変更。Layout は変更不要 | data.ts:25 が cache() なしで auth.api.getSession() 呼出。gRPC 化後に毎ページ二重ラウンドトリップ |
| I-8 | 🟡 | Proto を AuthService(5) + UserService(4) に分離すべき | 既存コードの責務分離を Proto でも維持。9 RPC を 1 service に詰めると God Service | user-service.ts と auth-service.ts が明確に分離 |
| I-9 | 🟡 | gRPC エラー → TaggedError マッピング未定義 | AuthServiceUnavailable / AuthServiceTimeout 等のインフラ用 TaggedError を auth-client に追加 | 既存 auth-errors.ts の cause:unknown では「サービスダウン」と「セッション不正」が区別不能 |
| I-10 | 🟡 | 3層キャッシュの説明が曖昧。L1/L2 は auth-service 内部のレイテンシ削減であり taimei→auth-service の RPC ホップは削減しない | プランの「認証サービスへのリクエスト不要」を「auth-service 内部で DB クエリ不要」に修正 | セッション検証の 3 層キャッシュ セクション |
| I-11 | 🟡 | API Route「プロキシ or 削除」未決定 + OAuth callback URL / Magic Link URL の変更が前提条件 | 「削除」に確定。GitHub Developer Settings の callback URL を auth.taimei-code.com に変更する手順を Phase 1 に追加 | 直接アクセス方式なら API Route 不要 |

### 新規 Nice-to-have

| # | 重要度 | 指摘 | 推奨対応 |
|---|--------|------|---------|
| N-3 | 🟢 | SameSite=Lax で十分（app1.taimei-code.com → auth.taimei-code.com は same-site） | プランに「SameSite=Lax。same registrable domain のため None は不要」と明記 |
| N-4 | 🟢 | clearImage を UpdateUser({ image: null }) で代替可能 | Proto の ClearUserImage RPC を削除し UpdateUser に統合 |

### AC 追加提案（設計レビューによる追加）
- [ ] `[設計レビュー追加]` auth-service の CORS ヘッダー（Access-Control-Allow-Origin, credentials: true）が app1.taimei-code.com からの fetch で正常に動作すること
- [ ] `[設計レビュー追加]` ConnectRPC リクエストに X-Service-Key ヘッダーが付与され、auth-service 側で検証されること
- [ ] `[設計レビュー追加]` fetchCurrentUser() が verifySession() と同一リクエスト内で二重 RPC を発行しないこと（cache() で重複排除）
