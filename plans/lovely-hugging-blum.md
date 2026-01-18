# React パフォーマンスレビュー結果

## 概要

vercel-react-best-practices に基づき、3観点から調査を実施。

```
┌────────────────────────────────────────────────────────────┐
│  調査結果サマリー                                           │
├────────────────────────────────────────────────────────────┤
│  1. データフェッチ/ウォーターフォール  → 8.5/10（良好）     │
│  2. バンドルサイズ最適化              → 改善余地あり       │
│  3. 再レンダリング最適化              → 要修正箇所あり     │
└────────────────────────────────────────────────────────────┘
```

---

## 🔴 高優先度（要修正）

### 1. 依存配列なし useEffect
**ファイル**: `app/use-conform/components/confirm/form.tsx:23-27`

```typescript
// ❌ 現状: 毎レンダリング実行
useEffect(() => {
  if (form.status === "error") {
    replace("/use-conform/create");
  }
});

// ✅ 修正: 依存配列追加
useEffect(() => {
  if (form.status === "error") {
    replace("/use-conform/create");
  }
}, [form.status, replace]);
```

### 2. 状態の二重管理
**ファイル**: `app/steps/useContent.ts:15-17`

```typescript
// ❌ 現状: Jotai + useState 重複
const [storedSteps, setStoredSteps] = useAtom(stepsAtom);
const [stepProgresses, setStepProgress] = useState<StepProgress[]>(storedSteps);

// ✅ 修正: Jotai のみ使用
const [stepProgresses, setStepProgress] = useAtom(stepsAtom);
```

---

## 🟡 中優先度

### 3. ウォーターフォール（並列化可能）
**ファイル**: `app/dashboard/layout.tsx:12-14`, `app/setting/layout.tsx:12-14`

```typescript
// ❌ 現状: 直列実行
await verifySession({ returnTo: "/dashboard" });
const currentUser = await fetchCurrentUser();

// ✅ 修正: 並列実行
const [_, currentUser] = await Promise.all([
  verifySession({ returnTo: "/dashboard" }),
  fetchCurrentUser(),
]);
```

### 4. searchParams を依存配列に
**ファイル**: `lib/auth/messages/useAuthMessage.ts:32`

```typescript
// ❌ 現状: オブジェクト参照
}, [searchParams]);

// ✅ 修正: 値を直接指定
const errorParam = searchParams.get("error");
}, [errorParam]);
```

### 5. 関数の毎回再生成
**ファイル**: `app/setting/profile/crop-modal.tsx:37-43`

```typescript
// ❌ 現状: 毎レンダリング再生成
const onCropChange = (crop: Point) => setCrop(crop);
const onZoomChange = (zoom: number) => setZoom(zoom);

// ✅ 修正: useCallback でメモ化
const onCropChange = useCallback((crop: Point) => setCrop(crop), []);
const onZoomChange = useCallback((zoom: number) => setZoom(zoom), []);
```

---

## 🟡 中優先度（続き）

### 6. アイコンライブラリを lucide-react に統一
**対象ファイル**（@heroicons 使用箇所 - 15ファイル）:

| ファイル | 使用アイコン |
|---------|-------------|
| `app/dashboard/invoices/[id]/edit/not-found.tsx` | FaceFrownIcon |
| `app/ui/dashboard/revenue-chart.tsx` | CalendarIcon |
| `app/ui/dashboard/latest-invoices.tsx` | ArrowPathIcon |
| `app/ui/dashboard/nav-links.tsx` | HomeIcon, DocumentDuplicateIcon, UserGroupIcon |
| `app/ui/dashboard/cards.tsx` | BanknotesIcon, ClockIcon, UserGroupIcon, InboxIcon |
| `app/ui/search.tsx` | MagnifyingGlassIcon |
| `app/ui/invoices/status.tsx` | CheckIcon, ClockIcon |
| `app/ui/invoices/edit-form.tsx` | CurrencyDollarIcon, UserCircleIcon |
| `app/ui/invoices/buttons.tsx` | PencilIcon, PlusIcon, TrashIcon |
| `app/ui/invoices/pagination.tsx` | ArrowLeftIcon, ArrowRightIcon |
| `app/ui/invoices/create-form.tsx` | CurrencyDollarIcon, UserCircleIcon |
| `components/nav-user.tsx` | Cog6ToothIcon |
| `components/app-sidebar.tsx` | BanknotesIcon |
| `components/auth/email-link-auth-form.tsx` | ExclamationCircleIcon |
| `components/setting-sidebar.tsx` | Cog6ToothIcon, UserIcon |

```typescript
// ❌ 現状: @heroicons
import { BanknotesIcon } from "@heroicons/react/24/outline";

// ✅ 修正: lucide-react
import { Banknote } from "lucide-react";
```

---

## 🟢 低優先度（今回対象外）

### 7. 過剰な useCallback
**ファイル**: `app/steps/step-form.tsx:17-37`
- `renderStepButton` は1回のみ使用、インライン化を検討

### 8. next/dynamic の活用機会
- `crop-modal.tsx` などモーダル系を遅延ロード可能

---

## 良好な実装（変更不要）

| 項目 | 評価 |
|------|------|
| Suspense boundaries | ✅ 適切に分割 |
| Promise.all() 使用 | ✅ `invoices/[id]/edit/page.tsx` |
| Effect-TS Service | ✅ データアクセス統一 |
| 'use client' 配置 | ✅ 必要箇所のみ |
| barrel imports | ✅ 最小限 |

---

## 実装計画（PRチェーン版）

```
main
 └── PR1 (refactor/react-performance-optimization)
       └── PR2 (refactor/unify-icon-library-ui)
             └── PR3 (refactor/unify-icon-library-final)

マージ順: PR1 → PR2 → PR3（コンフリクト回避）
```

### PR1: React パフォーマンス最適化（6ファイル）
**ブランチ**: `refactor/react-performance-optimization` ← main

| # | ファイル | 修正内容 |
|---|---------|---------|
| 1 | `app/use-conform/components/confirm/form.tsx` | useEffect 依存配列追加 |
| 2 | `app/steps/useContent.ts` | 二重管理解消 |
| 3 | `app/dashboard/layout.tsx` | 並列化 |
| 4 | `app/setting/layout.tsx` | 並列化 |
| 5 | `lib/auth/messages/useAuthMessage.ts` | 依存配列修正 |
| 6 | `app/setting/profile/crop-modal.tsx` | useCallback 追加 |

---

### PR2: アイコンライブラリ統一 - app/ui/（8ファイル）
**ブランチ**: `refactor/unify-icon-library-ui` ← PR1ブランチ

| # | ファイル |
|---|---------|
| 1 | `app/dashboard/invoices/[id]/edit/not-found.tsx` |
| 2 | `app/ui/dashboard/revenue-chart.tsx` |
| 3 | `app/ui/dashboard/latest-invoices.tsx` |
| 4 | `app/ui/dashboard/nav-links.tsx` |
| 5 | `app/ui/dashboard/cards.tsx` |
| 6 | `app/ui/search.tsx` |
| 7 | `app/ui/invoices/status.tsx` |
| 8 | `app/ui/invoices/edit-form.tsx` |

---

### PR3: アイコンライブラリ統一 - 残り + 依存削除（8ファイル）
**ブランチ**: `refactor/unify-icon-library-final` ← PR2ブランチ

| # | ファイル |
|---|---------|
| 1 | `app/ui/invoices/buttons.tsx` |
| 2 | `app/ui/invoices/pagination.tsx` |
| 3 | `app/ui/invoices/create-form.tsx` |
| 4 | `components/nav-user.tsx` |
| 5 | `components/app-sidebar.tsx` |
| 6 | `components/auth/email-link-auth-form.tsx` |
| 7 | `components/setting-sidebar.tsx` |
| 8 | `package.json` - @heroicons/react 削除 |

---

### 検証方法（各PR共通）
- `bun tsc --noEmit` - 型チェック
- `bun eslint .` - リント
- `bun run test:db` - テスト実行
- 手動確認: ダッシュボード、設定ページの動作確認
