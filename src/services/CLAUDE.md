# src/services

- Service は `Db` (drizzle) を直接使い、Repository 層は作らない。
- 割り当て・スキルがチームにあること・名前の一意は事前の query で確かめず、`team-queries.ts` の `runWrite` で書いて制約の違反を tagged error に写す。
