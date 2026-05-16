# ADR-0001: npm サプライチェーン攻撃への hardening

- **Status**: Accepted
- **Date**: 2026-05-16
- **References**: [taimei-code/taimei-auth#37](https://github.com/taimei-code/taimei-auth/pull/37) (ADR-0009)

## Context

2026-05-11 の TanStack Mini Shai-Hulud worm を契機に、npm エコシステムにおけるサプライチェーン攻撃の preventive hardening を taimei に導入する。

過去 1 年の主要事件:
- axios (4h で yank)
- Solana web3.js (5h)
- ua-parser-js (4h)
- TanStack Mini Shai-Hulud (6 分間隔の 2 wave)

悪性 version の生存時間がいずれも 4〜6 時間で yank されており、`bun install` で lockfile を更新する瞬間にこの窓を踏むだけで `postinstall` 経由の RCE が成立する。

taimei の現状:
- IoC は陰性、`@tanstack/*` 不在、`pull_request_target` 未使用 → 即時侵害は無い
- ただし GitHub Actions 経路と install lifecycle 経路は将来の同種事件で同じパターンを踏みうる
- `bun audit` で direct dep 3 件 + production transitive 6 種の既知 high が累積

## Decision

8 レイヤーの多重防御を導入する。

| # | レイヤー | 対策 | 実装箇所 |
|---|---|---|---|
| L1 | publish 窓 | `minimumReleaseAge = "7d"` | `bunfig.toml` |
| L2 | Actions 改ざん | tag → commit SHA pin | 全 workflow |
| L3 | pin 後の追従 | Dependabot weekly | `.github/dependabot.yml` |
| L4 | 既知脆弱性 gate | CI で `bun audit --audit-level=high` | `lint.yml` |
| L5 | install lifecycle | `bun install --ignore-scripts` | 全 workflow + Dockerfile |
| L6 | trusted 明示 | `trustedDependencies: []` | `package.json` |
| L7 | direct dep bump | `drizzle-orm` / `effect` / `next` (lockfile) | `package.json` + `bun.lockb` |
| L8 | transitive 固定 | `overrides` | `package.json` |

## Alternatives Considered

### publish environment (採用せず)
taimei は npm publish を行わないため不要。`@taimei-code/auth-client` は taimei-auth リポジトリで publish 済み。

### IoC scan の常時実行 (採用せず)
GitHub の `dependency-review-action` で十分。常時 IoC scan は false positive で CI 負荷が高い。将来 incident 時に都度走らせる運用とする。

### lock CODEOWNERS による `package.json` / `bun.lockb` 保護 (採用せず)
チーム規模が小さく review プロセスで十分。将来オンボーディングが進んだ時点で再検討。

### bcrypt → Better Auth 完全移行による tar 脆弱性根絶 (別 PR の責務)
ADR-005/006 で進行中の移行が完了すれば `bcrypt` が不要になり `tar` 経由の脆弱性自体が消える。本 ADR では override で時間を稼ぐ。

## Consequences

### Positive
- 8 レイヤーすべてが破られない限り `postinstall` RCE が成立しない
- `bun audit` CI gate により新規 high が混入した瞬間に検知できる
- Dependabot で SHA pin の自動追従が可能

### Negative
- `minimumReleaseAge = "7d"` により最新 version の追従が 7 日遅れる
- Dependabot weekly PR がノイズになる可能性 → `open-pull-requests-limit: 5` で抑制
- `overrides` 増加で `bun.lockb` が大きく動き、レビュー負荷が上がる
