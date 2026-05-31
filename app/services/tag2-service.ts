import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { and, eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { Tag2Id } from "@/app/schema/tag2";
import { tags2 } from "@/db/drizzle/schema";
import { companyFilter } from "@/db/scoped";
import { CompanyContext } from "./company-context";
import { Tag2NotFound, Tag2ParseError, Tag2ServiceError } from "./tag2-errors";

export class Tag2Service extends Effect.Service<Tag2Service>()(
  "services/Tag2Service",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      // id を DB へ渡す前に UUID 形式を検証する。tags2.id は uuid 列のため不正文字列は
      // PostgreSQL の cast エラー (500 相当) になる → 事前検証で Tag2ParseError として弾く。
      const validateTag2Id = (id: string) =>
        Effect.gen(function* () {
          yield* Schema.decode(Tag2Id)(id).pipe(
            Effect.catchTag(
              "ParseError",
              (error) =>
                new Tag2ParseError({
                  message: `Tag2ParseError: ${error.message}`,
                }),
            ),
          );
        });

      // 社ごとのラベル辞書として scope する。設計詳細: docs/adr/0002-company-data-scoping.md。
      const findAll = () =>
        Effect.gen(function* () {
          const { companyId } = yield* CompanyContext;
          return yield* Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(tags2)
                .where(companyFilter(tags2, companyId)),
            catch: (e) =>
              new Tag2ServiceError({ message: `findAll failed: ${e}` }),
          });
        });

      const find = (id: string) =>
        Effect.gen(function* () {
          yield* validateTag2Id(id);
          const { companyId } = yield* CompanyContext;
          // 他社 id は WHERE で除外 → 空 → Tag2NotFound (404 = 存在自体を隠蔽)。
          const tag = yield* Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(tags2)
                .where(and(eq(tags2.id, id), companyFilter(tags2, companyId)))
                .then((res) => res.at(0)),
            catch: (e) =>
              new Tag2ServiceError({ message: `find failed: ${e}` }),
          });
          if (!tag) {
            return yield* new Tag2NotFound({ id });
          }
          return tag;
        });

      return {
        findAll,
        find,
      } as const;
    }),
  },
) {}
