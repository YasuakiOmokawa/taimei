# src/lib

画面に出す失敗の文言と報告するかどうかは `team-failure.ts` の表が tag ごとに決め、文言は `failureMessage` で引く (表に tag を足す手順は `src/services/CLAUDE.md`)。予期しない失敗は `reportUnexpectedFailure` で 1 回だけ報告する。
