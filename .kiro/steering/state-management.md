# State Management Standards

クライアント/サーバー状態の分離パターン。

## Philosophy

- **サーバー状態**: Effect-TS Service（DB、外部API）
- **クライアント状態**: Jotai atoms（UIローカル状態）
- **認証状態**: Better Auth session（クライアント + サーバー両対応）

## 状態の分類

| 種類 | 管理方法 | 例 |
|------|----------|-----|
| サーバーデータ | Effect-TS Service + Server Components | 顧客一覧、請求書 |
| 認証セッション | Better Auth `useSession()` | ログインユーザー情報 |
| UIローカル状態 | Jotai atoms / React useState | モーダル開閉、フォーム入力 |

## Better Auth セッション

### クライアント側
```typescript
// app/lib/hooks/useCurrentUser.ts
"use client";
import { authClient } from "@/lib/auth-client";

export function useCurrentUser() {
  const { data: session } = authClient.useSession();
  const { id, name, email, image } = session?.user ?? {};
  return { id: id ?? "", name: name ?? "", email: email ?? "", image: image ?? "" };
}
```

### サーバー側
```typescript
// Server Component / Server Action
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
```

## Jotai パターン

### 配置
`app/lib/atoms/` にドメイン単位で配置

### 使用場面
- モーダル/ダイアログの開閉状態
- 一時的なUI状態（選択中のタブ等）
- クライアントサイドのフィルタ/ソート

> **注意**: サーバーから取得したデータのキャッシュには使用しない（Server Componentsで直接取得）

## カスタムフック

**配置**: `app/lib/hooks/`

```
app/lib/hooks/
├── useCurrentUser.ts    # 認証ユーザー取得
├── useMobile.ts         # レスポンシブ判定
└── login/
    └── useRedirectPath.ts
```

### 命名規約
- `use` プレフィックス
- ドメインに関連する名前（`useCurrentUser`, `useIsMobile`）

## サーバーデータ取得

### Server Components から直接
```typescript
// app/dashboard/page.tsx (Server Component)
import { fetchInvoices } from "@/app/lib/data";

export default async function Page() {
  const invoices = await fetchInvoices();
  return <InvoiceList invoices={invoices} />;
}
```

### Client Components へは props 経由
```typescript
// Server Component でデータ取得 → Client Component へ渡す
<ClientComponent initialData={serverData} />
```

## 禁止事項

- クライアントからの直接DB/API呼び出し
- Jotaiでのサーバーデータキャッシュ（stale問題を避ける）
- グローバル状態の乱用（必要最小限に）

---
_Focus on patterns and boundaries. No state library implementation details._
