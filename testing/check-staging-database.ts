// biome-ignore lint/style/noRestrictedImports: staging の deploy の job は、Worker と同じ要求ごとの Pool で印を確かめ、Pool を閉じて終わる
import { runWithRequestPool } from "@/db/drizzle/pool";
import { requireMarkedDatabase } from "./non-production-database";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL が無い");

await runWithRequestPool(databaseUrl, () => {}, requireMarkedDatabase);
console.info("DB に本番以外の DB の印の表がある");
