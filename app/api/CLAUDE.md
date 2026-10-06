# app/api

- `proxy.ts` は cookie の無い request を、`/api` を含めて taimei-auth へ redirect する。cookie なしで呼ばれる route (Vercel Cron など) は `proxy.ts` の `EXACT_PUBLIC_PATHS` に足す。Vercel Cron は redirect を追わない。
- cron の route は `Authorization: Bearer <CRON_SECRET>` を確かめ、`CRON_SECRET` が無ければ 503 を返す (`cron/purge-departed/route.ts`)。schedule は root の `vercel.json`。
