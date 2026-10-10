# src/lib

失敗の文言・API の状態コード・報告するかどうかは `team-failure.ts` の表が tag ごとに決め、`failureMessage`・`failureStatus` で引く (表に tag を足す手順は `src/services/CLAUDE.md`)。予期しない失敗は `reportUnexpectedFailure` で 1 回だけ報告する。
