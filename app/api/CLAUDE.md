# app/api

- `proxy.ts` は cookie の無い request を、`/api` を含めて taimei-auth へ redirect する。cookie なしで呼ばれる route (定期実行など) は `proxy.ts` の `EXACT_PUBLIC_PATHS` に足す。
- cron の route は `Authorization: Bearer <CRON_SECRET>` を確かめ、`CRON_SECRET` が無ければ 503 を返す (`cron/purge-departed/route.ts`)。1 時間ごとに呼ぶのは `.github/workflows/purge-departed.yml` (GitHub の Actions secret と Vercel の production の環境変数に同じ `CRON_SECRET`)。
