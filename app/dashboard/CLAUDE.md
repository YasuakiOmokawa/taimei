# app/dashboard

- 各 page は先頭で `requireCompany({ returnTo: "<その page の path>" })` を呼ぶ。layout は client 側の遷移で再実行されない (Next の Partial Rendering) ので、layout では redirect しない。
- チームの読み書きは `teams/run-team-service.ts` の `runTeamService` を、チームの管理 (管理者だけの操作) は `runTeamManagement` を通す (予期しない失敗は Sentry に送る)。Server Action のフォームは `teams/action-form.tsx` の `ActionForm` で包む。
