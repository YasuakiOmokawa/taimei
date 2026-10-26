# ADR-0010: 本番以外の振る舞いは本番以外の入口が本番の入口を包んで足し、本番の code は自分が本番かを知らない

- **Status**: Accepted
- **Date**: 2026-10-26
- **References**: #650、ADR-0006、taimei-auth の ADR-0021

## Context

開発環境・e2e・qa には、taimei-auth の開発者ホームへ移る `/dev-home` が要る。本番には要らない。taimei-auth は ADR-0021 で、本番の code は自分が本番かを知らず、本番以外の機能を本番の成果物に入れないと決めている。

## Decision

- 本番以外の振る舞いは `testing/worker.ts` が本番の入口 `src/worker.ts` の default を包んで足す。`testing/worker.ts` は `GET /dev-home` だけを自分で返し、ほかの要求を本番の入口に渡す。Durable Object の class は本番の入口から再 export する
- `src`・`db` は環境変数や設定で本番以外の振る舞いを出し分けず、`testing/` を import しない。その import は `.fallowrc.json` の boundaries の zone `non-production` が止める
- `wrangler dev` (`scripts/wrangler-dev.sh`) は本番以外の入口で起動し、本番の deploy は `wrangler.jsonc` の `main` (`src/worker.ts`) を使う。`main` は試験で固定する
- config は `wrangler.jsonc` を共有する。本番の Worker も `run_worker_first` の `/dev-home` を受け、404 を返す

## Considered Options

- **`src` に環境変数の分岐を置く**: 本番の code が本番以外の経路を持ち、設定を誤ると本番に出る
- **taimei-auth のように別の name の config で隔てる**: `/dev-home` は redirect するだけで任意の利用者になる能力を持たず、config を二重に保つ手間に見合わない

## Consequences

- 本番以外の入口が足せるのは、本番の入口の handler を包む振る舞いだけである
- 入口の module は handler と class 以外 (定数など) を export すると workerd が起動しない。試験に使う値は入口から export しない
