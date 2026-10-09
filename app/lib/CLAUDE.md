# app/lib

Server Action / Server Component は `runService` (事業所スコープは `runScopedService`、管理者だけの操作は `runManagerScopedService`) で実行し、返る `Result` を `failure._tag` で分岐する。try-catch は書かない。
