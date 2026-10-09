# app/lib

Server Action / Server Component は `runService` (事業所スコープは `runScopedService`、管理者だけの操作は `runManagerScopedService`) で実行し、返る `Result` を `failure._tag` で分岐する。try-catch は書かない。予期しない失敗はこれらの関数が Sentry に送るので、呼び手は送らない。画面に出す失敗の文言と Sentry に送るかどうかは `team-failure.ts` の表が tag ごとに決め、文言は `failureMessage` で引く (表に tag を足す手順は `app/services/CLAUDE.md`)。
