# Taimei

## 前提

- 開発環境と e2e は、root での `bun install` と `docker login ghcr.io` が要る (手順は `e2e/README.md` の「前提」)。root の `docker compose` は `bun install` が入れる SDK の compose の断片を読むので、`bun run test:db` も `bun install` の後に動く
- `.env` に `NPM_TOKEN=<read:packages 権限の GitHub PAT>` (`@taimei-code/auth-client` の取得用)
- port 3001 / 3100 / 5433 / 5434 が空いていること

## 開発環境

```console
docker compose up --build --watch
```

taimei と taimei の DB に加え、SDK の compose の断片で taimei-auth と auth の DB が起動する。

ログインは `http://app.taimei-code.localhost:3001/dev-home` を開く。taimei-auth の開発者ホームに移る。開発用アカウントを押すとその利用者でログインして開発者ホームに戻り、別のアカウントを押せば同じ画面のまま利用者が切り替わる。「アプリケーションに戻る」を押すと taimei のトップに移り、ダッシュボードへはトップの「ログイン」で入る。ログインしていない時、トップの「ログイン」は本番と同じログイン画面を開き、開発用アカウントの一覧を出さない。

- 開発用アカウントの role: OWNER は事業所 1・2 で OWNER、ADMIN は事業所 1 で ADMIN・事業所 2 で MEMBER、MEMBER は事業所 1 で MEMBER。事業所の id は固定なので、taimei の DB のデータも起動をまたいで見える
- 利用者を選ぶたびに Magic Link が 1 通送られる。同じ email に 60 秒で 3 通、全体で 60 秒に 5 通を超えると止まる
- Chrome で確かめている (`*.localhost` を自分で loopback に解決し、http でも `Secure` の cookie を受け取る)

taimei の DB と auth の DB は `docker compose down` の後も残る。空にする時は `docker compose down -v` を使う。SDK を上げた後は `docker compose up --watch` を起動し直す (起動中の watch は古い compose の断片で taimei-auth を作り直し、起動しないまま残る)。

taimei は SPA (`web/`) を `bun run build` で build し、本番以外の入口 `testing/worker.ts` (本番の入口 `src/worker.ts` に `/dev-home` を足したもの、ADR-0010) と一緒に `bun run start` (`wrangler dev`) で配る。`wrangler dev` は `.env`・`.dev.vars` を読まず、`APP_`・`AUTH_` で始まる環境変数だけを Worker に渡す (`scripts/wrangler-dev.sh`)。画面だけを直すときは `bun run dev` (vite の dev server) で見る。

## E2E

流し方は `e2e/README.md`。

## 型チェック

`bun run typecheck` を使う (TypeScript 7。root と `web/` の tsconfig を両方検査する)。Effect の書き間違い (`yield*` の無い Effect など) も、`@effect/tsgo` に同梱の Effect の診断入りの `tsc` が型エラーにする。診断の重さは `tsconfig.json` の `plugins` で決める。

`@effect/tsgo` は対応する `typescript` の版を狭く決めていて、合わない版では `bun run typecheck` が `UnsupportedTargetPackageVersionError` で止まる。`typescript` は、`node_modules/@effect/tsgo/README.md` の Supported Package Versions に載る版へ、`@effect/tsgo` と一緒に上げる。
