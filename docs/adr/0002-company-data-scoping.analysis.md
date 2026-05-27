# ADR-0002 company data scoping — 受け入れ条件分析

### Tier
Tier: deep (DB migration + security/IDOR scoping = リスク領域強制。schema/services/auth-guard/data/actions/package.json の 6+ ファイル multi-concern)

## 受け入れ条件

### 検討観点 (controlled vocabulary)
- 機械抽出変更種別: db_change (`db/drizzle/schema.ts` + `drizzle/*.sql`), auth_change (`app/lib/auth-guard.ts` requireCompany + scoping=access control), service_change (`app/services/*-service.ts` + `index.ts` runScopedService), dependency_change (`package.json` SDK 1.1.0)
- permission: cross-company アクセス制御 (IDOR) が本 ADR の中核なので主軸採用 (auth 文脈強調により副作用軸でなく主軸)
- auth_state: companyId 選択状態 (未選択→redirect / 選択済→scoped) が分岐の要なので auth_change の認証状態軸を採用
- data_compat: company_id 列追加 + backfill + NOT NULL 化 + revenue unique 変更の既存データ互換 (db_change)
- caller: scoped 処理を runScopedService 経由に統一する call-site 正当性 + 型 closure (service_change の呼び出し元軸)
- contract: SDK getSession() の companyId 契約 (1.1.0 提供) との境界 (Step B 汎用候補軸 contract、dependency_change の semver 文脈)
- observability 追加: observability (理由: cross-company アクセスや scoping エラーの構造化ログで Critical 検出力を上げる、上限 5 にカウントしない特例)

### 正常系
- [ ] permission: company A の user が GET /dashboard/invoices → 自社 invoice のみ一覧 (B 社 invoice を含まない)
- [ ] auth_state: companyId 選択済 session で /dashboard アクセス → redirect なしで scoped データ描画
- [ ] data_compat: migration 適用後、全 scoped テーブルに `company_id` NOT NULL 列 + index が存在し既存行は backfill 済 (`SELECT count(*) WHERE company_id IS NULL` = 0)
- [ ] caller: `data.ts`/`actions.ts` の scoped 処理が `runScopedService` 経由で実行され、`InvoiceService.findById` が `CompanyContext.companyId` を WHERE に付与する
- [ ] contract: SDK 1.1.0 で `getSession()` が `companyId: string` / `currentCompanyName` / `currentCompanyRole` を返す (新規 signup user で `companyId` 非 null)
- [ ] observability: scoping 経路の DB エラー時に既存 `console.error("Database Error:", ...)` 踏襲でエラーが記録される

- [ ] `[MECE追加]` permission: `CustomerService.findAll` が現在の company の customers のみ返す (他社 customer は invoice 作成 dropdown / 一覧に出ない) — CR2/M1
- [ ] `[MECE追加]` data_compat: migration 後 `revenue` の unique が `(company_id, month)` のみで `(month)` 単独 unique が残らない (別 company で同月行を作れる) — IM4

### 異常系
- [ ] permission: company A の user が他社 invoice id を直打ち GET /dashboard/invoices/&lt;B社id&gt;/edit → 404 Not Found (存在隠蔽、403 ではない)
- [ ] auth_state: `companyId === undefined` (事業所未選択) の session で /dashboard → 302 redirect → `{NEXT_PUBLIC_AUTH_URL}/auth/signup/company`
- [ ] data_compat: backfill 前に NOT NULL 制約を適用 → 既存 NULL 行で migration 失敗 → 3 段手順 (nullable→backfill→not null) で回避、未充足なら migration abort
- [ ] caller: scoped Service (`yield* CompanyContext` を持つ Effect) を `runService` に渡す → `bun tsc --noEmit` でコンパイルエラー (CompanyContext not assignable)
- [ ] contract: SDK が `^1.0.0` のまま (未 upgrade) → `getSession().companyId` が型に存在せず tsc エラー / 実行時 undefined (Phase 0 ブロッカー)
- [ ] observability: `verifySession` outcome != "ok" → SessionError、null session として `/auth` redirect (既存 auth-guard 挙動踏襲、companyId 評価前)

- [ ] `[MECE追加]` permission: 他社 invoice id で `updateInvoice` / `deleteInvoice` → 404 かつ他社行が変化しない (rows affected = 0) — CR1/BB-I1
- [ ] `[MECE追加]` permission: `create` / `update` で自社スコープ外の `customerId` を渡す → NotFound 相当で拒否 (`customerId` の自社帰属を検証。`companyFilter` は invoices 側のみで create 入力を塞がない) — CR1/WB-C1
- [ ] `[MECE追加]` permission: customer 一覧の集計 (`totalPaid`/`totalPending`) に他社 invoice 金額が混入しない (`fetchFiltered` の leftJoin invoices に `companyFilter` を AND) — IM1/WB-I3
- [ ] `[MECE追加 変更]` observability: AC-12 を再定義 — scoping 経路は SDK guard `getSession` が `!ok` で null を返し `/auth` redirect する (Effect 版 `AuthService.getSession` の `SessionError` は本番呼出ゼロ=非影響確認へ。変更理由: AC-12 が実 scoping 経路でない Effect 版を指していた) — IM8/WB-N1

### エッジケース (境界値チェックリストより)
- [ ] permission [境界値: 他人]: company A user が `customerId` = B 社 customer で invoice 作成 → A 社スコープに当該 customer 無く 404/作成不可 (customer も company-private)
- [ ] auth_state [境界値: 状態=削除済]: 唯一所属 company が DELETED 後 `companyId` undefined → redirect (membership 0 件と同等)
- [ ] data_compat [境界値: 配列=空]: scoped テーブルが 0 行で migration → backfill no-op で正常完了 (既存「データがない場合は 0 ページ」テスト踏襲)
- [ ] caller [境界値: 同時=複数ユーザー]: 2 タブで別 company に切替後それぞれ data fetch → 各 request の `getSession` (react.cache は per-request) が正しい companyId を導出 (cross-request 汚染なし)
- [ ] contract [境界値: 状態=初期]: 新規 signup 直後 membership 0 件で `companyId` undefined → signup company step へ redirect
- [ ] observability [境界値: 権限=未ログイン]: 未認証で scoped 処理 → `requireSession`/`getSession` が null → `/auth` redirect (companyId 評価に到達しない)

- [ ] `[MECE追加]` permission [境界値: 他人]: 他社 tag id で invoice に tag 付与 → join 行が作られない (tags は Phase2 で scope。Phase1 完了時点は `_invoicesTotags` が列なしで A 社 invoice ↔ B 社 tag を張れる leak 窓が開く点を明示) — IM5/BB-I3

### 非影響確認 (推奨)
git 判定: 実装未着手 (plan mode、git status は ADR/CONTEXT の新規 `A` のみ)。plan 本文の変更予定ファイルは既存ファイル改変 (`M` 相当) のため (a) 手動列挙を (推定) で実施。
- [ ] 非 scoped 認証フロー (`sendMagicLink` via `runService`) が変わらないこと (推定)
- [ ] `after-signin` / `after-signup` ページの `getSession` 着地挙動が変わらないこと (推定)
- [ ] dashboard layout の未認証 → `/auth` redirect が `requireCompany` 化後も維持されること (推定)
- [ ] `runService` (非 scoped) 経路が型・実行とも従来通り (CompanyContext 非依存) であること (推定)
- [ ] `[MECE追加]` observability: cross-company write 試行 (他社 id での mutation) を正常 not-found と区別する構造化ログ (試行 companyId / 対象 id / 経路) で記録 — IM7/M2
- [ ] `[MECE追加]` caller: `CompanyContext` に載る companyId の供給元を session の単一 companyId と定義し、複数 company 所属ユーザーの解決 (どの company を context に載せるか) を仕様化 — IM6/M4

## 技術リスク

### リスク1: runScopedService の型 closure が実効か
- **何がわからないか**: scoped Service を `runService` に渡すと本当にコンパイルエラーになるか未検証。
- **最悪何が起きるか**: 型で防げず開発者が非 scoped 実行を書き company filter なしの IDOR が ship する。
- **どうやって検証するか**: scoped Service を `runService` に渡す実験コードを 1 つ書き `bun tsc --noEmit` で error を確認する。

### リスク2: getSession (react.cache) が Server Action 内で機能するか
- **何がわからないか**: `runScopedService` 内の `getSession` が Server Action コンテキストで cache dedupe と `cookies()` 読取を正しく行うか不明。
- **最悪何が起きるか**: mutation (createInvoice 等) で companyId 取得が二重 RPC / cache miss し性能劣化または取得失敗で誤 redirect が起きる。
- **どうやって検証するか**: 未選択でない session で createInvoice を実行し `/api/auth/get-session` 呼出回数を Network tab で観測する。

### リスク3: redirect() が Effect.either に飲まれないか
- **何がわからないか**: `runScopedService` の `redirect()` が `Effect.either` 実行前 throw として NEXT_REDIRECT を正しく伝播するか未確認。
- **最悪何が起きるか**: redirect が握り潰され未選択 user が空データ画面や 500 を見る。
- **どうやって検証するか**: companyId undefined の session で /dashboard に実アクセスし 302 → `/auth/signup/company` を確認する。

### リスク4: revenue unique 変更の migration 安全性
- **何がわからないか**: `(month)` → `(company_id, month)` の unique 変更を drizzle-kit が drop+再作成 SQL で正しく生成し既存データで失敗しないか不明。
- **最悪何が起きるか**: 既存 month 重複や制約 drop 漏れで migration が staging で失敗しデプロイが止まる。
- **どうやって検証するか**: `bunx drizzle-kit generate` 後の SQL をレビューし `bun run test:db` 相当の test_db で migrate を実行する。

## MECE分析結果

### 分析サマリー
- 分析日時: 2026-05-27
- 対象リポジトリ: YasuakiOmokawa/taimei (Wiki Researcher は `[Devin未使用]` — Devin wiki 未収録、preflight で非起動)
- ACカバレッジ: 17/30 項目充足 (元 22 のうち充足 17、`[MECE追加]` 8 件は未判定で分母に算入)
- 漏れ件数: 4 (お見合い M1-M4)
- 重複件数: 2 (補強し合う合意 X1/X2、真の合意 0)
- 判定: **要修正 (Critical 2件)**

### 4分類クロスリファレンス
| # | Area | BB | WB | 分類 | Severity | 統合内容 |
|---|---|---|---|---|---|---|
| X1 | data | BB-I2 | WB-N2 | 補強し合う合意 | 🟡 | revenue unique 移行の最終状態検証 + read-only 前提 (id PK 不在) |
| X2 | security | BB-I1 | WB-C1 | 補強し合う合意 | 🔴 | mutation IDOR: read 404 (BB) + write 入力注入 (WB) の別軸。create/update の customerId 無検証 + customers FK グローバル |
| X3 | data | BB-I3 | — | 実装漏れ | 🟡 | `_invoicesTotags` が列なしで A社 invoice↔B社 tag を張れる。Phase1 は tags 未scope の leak 窓 |
| X4 | data | — | WB-I1 | 仕様漏れ | 🟡 | invoice/customer/revenue/tags factory 不在 (factories は user のみ)。「factory に追加」でなく net-new |
| X5 | data | — | WB-I2 | 仕様漏れ | 🟡 | `effect-test-helpers` が CompanyContext 未提供 → scoped 化で既存テストもコンパイル不能 |
| X6 | security | — | WB-I3 | 仕様漏れ | 🟡 | `customer-service.fetchFiltered` の leftJoin invoices に company AND 無く金額 leak |
| X7 | auth | — | WB-N1 | 仕様漏れ | 🟢 | AC-12 の SessionError は Effect 版の挙動。scoping 経路 (SDK guard) は !ok で null |
| X8 | auth | — | WB(AC-5) | 仕様漏れ | 🟡 | SDK ^1.1.0 upgrade が全 session-companyId AC の blocking 前提 (現行 1.0.0) |
| M1 | security | — | — | お見合い | 🔴 | `CustomerService.findAll` 無 scope。dropdown だけが防御になり API 直叩きで崩れる |
| M2 | observability | — | — | お見合い | 🟡 | cross-company write 試行の監査ログ (正常 not-found と区別) |
| M3 | concurrency | — | — | お見合い | 🟢 | create の customerId 検証を SELECT→INSERT 2 段にすると TOCTOU 窓 |
| M4 | auth | — | — | お見合い | 🟡 | CompanyContext 供給元 (複数 company 所属の解決) が未定義 |

### ACカバレッジ検証結果
| AC-ID | 要約 | カテゴリ | BB | WB | 総合 |
|---|---|---|---|---|---|
| AC-1 | 自社 invoice のみ一覧 | 正常系 | 充足 | 充足 | 充足 |
| AC-2 | 選択済→scoped 描画 | 正常系 | 充足 | 充足 | 充足 |
| AC-3 | company_id NOT NULL + index + backfill | 正常系 | 不十分 | 充足 | **不十分** (revenue unique 検証欠落) |
| AC-4 | runScopedService 経由 + WHERE 付与 | 正常系 | 充足 | 充足 | 充足 |
| AC-5 | SDK getSession companyId 返却 | 正常系 | 充足 | 不十分 | **不十分** (SDK ^1.1.0 upgrade 前提) |
| AC-6 | DB エラー console.error 踏襲 | 正常系 | 充足 | 充足 | 充足 |
| AC-7 | 他社 id GET/edit → 404 | 異常系 | 不十分 | 充足 | **不十分** (update/delete 未 AC 化) |
| AC-8 | 未選択→302 signup/company | 異常系 | 充足 | 充足 | 充足 |
| AC-9 | NOT NULL 化 3 段 | 異常系 | 充足 | 充足 | 充足 |
| AC-10 | scoped Service を runService → tsc エラー | 異常系 | 充足 | 充足 | 充足 |
| AC-11 | ^1.0.0 のまま → 型エラー | 異常系 | 充足 | 充足 | 充足 |
| AC-12 | verifySession !ok → redirect | 異常系 | 充足 | 不十分 | **不十分** (経路ずれ、再定義要) |
| AC-13 | 他社 customerId で作成不可 | エッジ | 充足 | 不十分 | **不十分** (create 無検証注入=Critical) |
| AC-14 | DELETED 後 undefined→redirect | エッジ | 充足 | 充足 | 充足 |
| AC-15 | 0 行 migration no-op | エッジ | 充足 | 充足 | 充足 |
| AC-16 | 2 タブ別 company per-request | エッジ | 充足 | 充足 | 充足 |
| AC-17 | 新規 signup membership 0→redirect | エッジ | 充足 | 充足 | 充足 |
| AC-18 | 未認証→/auth | エッジ | 充足 | 充足 | 充足 |
| AC-19〜22 | 非影響 (sendMagicLink/after-sign/layout/runService) | 非影響 | 充足 | 充足 | 充足 |
| `[MECE追加]` 8 件 | findall scope / revenue unique / update-delete IDOR / create customerId / 集計 leak / tag join / write 監査 / CompanyContext 供給元 | 各カテゴリ | 未判定 | 未判定 | 未判定 |

総合「不十分」: AC-3 / AC-5 / AC-7 / AC-12 / AC-13 (5 件)。

#### MECE分析によるAC追加提案 (本ファイルの各カテゴリに追記済)
- `[MECE追加]` update/delete の他社 id → 404 + rows affected=0 (CR1)
- `[MECE追加]` create/update の customerId 自社帰属検証 (CR1)
- `[MECE追加]` CustomerService.findAll の company scope (CR2)
- `[MECE追加]` 集計 leftJoin の金額 leak 防止 (IM1)
- `[MECE追加]` revenue unique (company_id, month) 最終状態検証 (IM4)
- `[MECE追加]` _invoicesTotags の cross-company 結合不可 (IM5)
- `[MECE追加]` cross-company write 試行の監査ログ (IM7)
- `[MECE追加]` CompanyContext 供給元の仕様化 (IM6)
- `[MECE追加 変更]` AC-12 を SDK guard null 経路へ再定義 (IM8)

### Critical指摘 (要修正)
| # | 指摘 | プラン該当箇所 | 推奨修正 | 根拠 | 4分類 |
|---|---|---|---|---|---|
| CR1 | mutation 経路 IDOR: update/delete の他社行不可視 + create/update の customerId 自社帰属検証が欠落。`companyFilter` は invoices 側のみで、create 入力の customerId はグローバル FK 経由で他社注入可 | D2 (create 例 `{...input, companyId}`)・D3 (3 重閉じ) | (1) update/delete に `companyFilter` を AND し他社 id は 404 + rows=0、(2) create/update で customerId の自社帰属を検証、(3)「型・companyFilter だけでは create 入力を塞がない」を D3 の例外として明記、(4) isolation テストに update/delete/create の cross-company 検証を必須化 | BB-I1 + WB-C1 (X2) | 補強し合う合意 |
| CR2 | `CustomerService.findAll` (customer-service.ts:14-28) が全 customers 無条件返却。invoice 作成 dropdown のソースで、CR1 と対で塞がないと「dropdown だけが防御」状態 | D1 (customers scope)・D4 (scoped helper 規約) | `findAll` を `companyFilter` 経由に。dashboard 等の全 list/aggregate 経路も company scope 棚卸し (T1) | M1 + T1 (お見合い→Critical 昇格) | お見合い |

### Important / Nice-to-have
| # | 重要度 | 指摘 | 推奨対応 | 根拠 |
|---|---|---|---|---|
| IM1 | 🟡 | 集計 leftJoin の他社金額 leak | `fetchFiltered` の leftJoin ON に invoices `companyFilter` を AND | WB-I3/X6 |
| IM2 | 🟡 | isolation テスト基盤不在 (factory 群 + CompanyContext helper) | Phase1 に factory 新規作成 + `effect-test-helpers` への CompanyContext 注入を追加 | WB-I1/I2/X4/X5 |
| IM3 | 🟡 | SDK ^1.1.0 upgrade が全 session-companyId AC の blocking 前提 | Phase0 を明示的 blocking precondition 化 | WB(AC-5)/X8 |
| IM4 | 🟡 | revenue unique 移行の最終状態検証 + read-only 前提 | data_compat に unique 状態 AC 追加、read-only を 1 文補足 | BB-I2/WB-N2/X1 |
| IM5 | 🟡 | `_invoicesTotags` の cross-company 結合 (Phase1 leak 窓) | tag 付与時の他社 tag join 不可を AC 化、Phase1 leak 窓を明示 | BB-I3/X3 |
| IM6 | 🟡 | CompanyContext 供給元 (複数 company 所属解決) 未定義 | session 単一 companyId か選択 UI かを仕様化 | M4 |
| IM7 | 🟡 | cross-company write 試行の監査ログ | mutation IDOR 試行を構造化ログで記録 (read 監査より優先) | M2 |
| IM8 | 🟡 | AC-12 の検証経路ずれ (SessionError vs SDK guard null) | AC-12 を SDK guard null 経路に再定義、Effect 版は非影響確認へ | WB-N1/X7 |
| N1 | 🟢 | create customerId 検証の TOCTOU | INSERT...WHERE EXISTS / FK+company 複合制約で原子化 | M3 |
| N2 | 🟢 | company_id index 設計 | invoices/customers/revenue に company_id 前置の複合 index | T2 |
| N3 | 🟢 | returnTo 往復 / data 経路 default 着地 | page 経路で returnTo 往復の正常系 AC、data 経路 default はトレードオフ明記 | BB-N2 |

### お見合い検出 (Red Team 独自)
| # | 領域 | 観点 | 発見事項 | Severity |
|---|---|---|---|---|
| M1 | security | 暗黙の前提 | CustomerService.findAll 無 scope → CR2 昇格 | 🔴 |
| M2 | observability | 責任の継ぎ目 | cross-company write 試行の監査欠落 | 🟡 |
| M3 | concurrency | 純技術リスク | create customerId 検証の TOCTOU | 🟢 |
| M4 | auth | 楽観的見積もり | CompanyContext 供給元 (複数所属) 未定義 | 🟡 |

### 純技術リスク補完 (Red Team)
| # | 観点 | 発見事項 | Severity |
|---|---|---|---|
| T1 | security (A01) | findAll 以外の list/aggregate 経路も company scope 棚卸し必要 | 🟡 |
| T2 | performance | company_id 複合 index が migration に含まれるか (fetchFiltered ilike OR の full scan 対策) | 🟢 |

### Red Teamレビューサマリー
<details>
<summary>Red Team 統合評価レポート (要点)</summary>

- 判定: 要修正 (Critical 2件: CR1 mutation IDOR / CR2 findAll 無 scope)
- 重複: 補強し合う合意 X1/X2 のみ、真の合意 0 (BB=仕様軸 / WB=コード軸で根拠層が一貫分離)
- AC-7 で BB=write軸 / WB=read軸 と評価視点が直交していたのが独立性の証左
- load-bearing claim を実機裏取り: create 無検証 insert (invoice-service.ts:27-43)、customers FK グローバル (schema.ts:54-61)、findAll 無 scope (customer-service.ts:14-28)、SDK guard !ok→null (auth-guard.ts:30)
- 確信度: 高
</details>

### 各ロール分析詳細
<details>
<summary>BB Analyst (仕様、[Devin未使用])</summary>

Critical 0 / Important 3 (BB-I1 mutation 404 未AC化, BB-I2 revenue unique 検証欠落, BB-I3 join 不変条件+Phase1 leak窓) / Nice 2 (BB-N1 cross-company 監査, BB-N2 returnTo 往復)。AC 判定: 20/22 充足、AC-3/AC-7 不十分。
</details>

<details>
<summary>WB Analyst (コード)</summary>

Critical 1 (WB-C1 = AC-13 create の他社 customerId 注入) / Important 3 (WB-I1 factory 不在, WB-I2 helper の CompanyContext 欠落, WB-I3 集計 join 金額 leak) / Nice 2 (WB-N1 AC-12 経路ずれ, WB-N2 revenue PK 不在)。AC 判定: AC-5/AC-12/AC-13 不十分、他 充足。
</details>

<details>
<summary>Wiki Researcher</summary>

`[Devin未使用]` — カレントリポ YasuakiOmokawa/taimei が Devin wiki 未収録。preflight (0-4.5) で `${DEVIN_COVERAGE}=none` 確定、Wiki Researcher 非起動。
</details>
