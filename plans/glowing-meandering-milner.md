# taimei ディレクトリ構成統一プラン

## 🎭 三者による議論

### t_wada（テスト駆動・設計重視）
> 「問題の本質は『新しいファイルをどこに置くべきか迷う』こと。配置ルールを決定表として明文化し、迷いをなくすべき。」

### Gary Bernhardt（シンプルさ追求）
> 「`app/lib/`という曖昧な名前が諸悪の根源。`actions/`, `schema/`, `hooks/`と責務で分けるべき。ディレクトリ名で中身がわかるのが正義。」

### DHH（Rails流・慣習重視）
> 「Next.js App Routerの慣習に従え。ページローカルなものはページ内に、共有するものは共有ディレクトリへ。過度な分割は害悪。」

### 合意点
- `app/lib/`を廃止し、責務別ディレクトリに分割
- 配置ルールを明文化してCLAUDE.mdに追記
- 移行は小さいPRに分割（2コミット以内）

---

## 📊 発見された問題

| # | 問題 | 現状 |
|---|------|------|
| 1 | Server Actions分散 | `app/lib/actions.ts` / `app/setting/profile/actions.ts` / `app/lib/use-conform/action.ts` |
| 2 | Zodスキーマ分散 | `app/lib/schema/` / `app/setting/profile/schema.ts` / `app/lib/use-conform/schema.ts` |
| 3 | Effect.Schema誤配置 | `app/schema/tag2.ts`（正式は`app/domain/`） |
| 4 | hooks分散 | `app/lib/hooks/` / `lib/auth/hooks/` / ページ内 |
| 5 | lib vs app/lib曖昧 | 責務が不明確 |
| 6 | 学習用コード混在 | `lib/sample/`（27ファイル） |

---

## 🎯 統一ルール

### 配置決定表

| カテゴリ | 配置場所 | 例 |
|---------|---------|-----|
| Server Actions | `app/actions/` | `app/actions/invoice.ts` |
| Zodスキーマ | `app/schema/` | `app/schema/invoice.ts` |
| Effect.Schema Brand型 | `app/domain/` | `app/domain/email.ts` |
| データ取得関数 | `app/data/` | `app/data/invoice.ts` |
| クライアントフック | `app/hooks/` | `app/hooks/use-avatar.ts` |
| Jotai Atoms | `app/atoms/` | `app/atoms/form.ts` |
| ページ固有UI | `app/ui/[feature]/` | `app/ui/invoices/table.tsx` |
| 認証設定 | `lib/auth/` | `lib/auth/auth.ts` |
| サービス層テスト | `app/services/__tests__/` | 維持 |

### After構造

```
app/
├── actions/          # Server Actions（機能別ファイル）
├── schema/           # Zodスキーマ（機能別ファイル）
├── data/             # データ取得関数（機能別ファイル）
├── hooks/            # クライアントフック
├── atoms/            # Jotai atoms
├── domain/           # Effect.Schema Brand型（維持）
├── services/         # Effect-TSサービス（維持）
├── layers/           # DI設定（維持）
├── ui/               # ページ固有UI（維持）
└── [pages]/          # ルートページ（page.tsx, layout.tsxのみ）

lib/
├── auth/             # Better Auth設定（統合）
│   ├── auth.ts
│   ├── auth-client.ts
│   ├── auth-guard.ts
│   ├── hooks/
│   └── messages/
├── email/            # メール送信（維持）
├── flash-toaster/    # Flash通知（維持）
└── utils.ts          # cn()等（維持）

components/           # 共有UI（維持）
├── ui/               # shadcn/ui
└── *.tsx             # アプリ固有共通
```

---

## 📋 移行計画（9 PRs）

### PR1: lib/sample削除
- `lib/sample/`（27ファイル）削除
- 依存なし、即実行可能

### PR2: Effect.Schema移動
- `app/schema/tag2.ts` → `app/domain/tag2.ts`
- importパス修正

### PR3: Server Actions統合（auth, invoice, user）
- `app/lib/actions.ts` → `app/actions/auth.ts`, `app/actions/invoice.ts`, `app/actions/user.ts`

### PR4: Server Actions統合（profile, use-conform）
- `app/setting/profile/actions.ts` → `app/actions/profile.ts`
- `app/lib/use-conform/action.ts` → `app/actions/use-conform.ts`

### PR5: Zodスキーマ統合
- `app/lib/schema/**` → `app/schema/`
- `app/setting/profile/schema.ts` → `app/schema/profile.ts`

### PR6: クライアントフック統合
- `app/lib/hooks/**` → `app/hooks/`（命名規則: `use-xxx.ts`）

### PR7: データ取得関数分割
- `app/lib/data.ts` → `app/data/`（機能別ファイル）

### PR8: lib/auth整理
- `lib/auth.ts`, `lib/auth-client.ts` → `lib/auth/`
- `app/lib/auth-guard.ts` → `lib/auth/auth-guard.ts`

### PR9: 残整理・ドキュメント更新
- `app/lib/atoms/` → `app/atoms/`
- `app/lib/`削除
- CLAUDE.md、structure.md更新

---

## ✅ 検証方法

各PR後に実行:
```bash
bun run test:db      # テスト
bun eslint .         # リント
bun tsc --noEmit     # 型チェック
```

---

## 📁 主要対象ファイル

- `app/lib/actions.ts` - 7関数を分割
- `app/lib/data.ts` - 15関数を分割
- `app/lib/hooks/` - 4ファイル移動
- `lib/auth.ts`, `lib/auth-client.ts` - 統合
- `.kiro/steering/structure.md` - 更新
