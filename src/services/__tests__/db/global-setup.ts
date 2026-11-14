import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5434/taimei_test";

const projectRoot = resolve(__dirname, "../../../../");

export async function setup() {
  console.log("🔧 Setting up test database...");
  await waitForDb();
  migrate();
  await runSql(
    readFileSync(resolve(projectRoot, "db/local-app-role.sql"), "utf8"),
  );
  console.log("✅ Test database ready");
}

function migrate() {
  try {
    execSync("bunx drizzle-kit migrate", {
      stdio: "inherit",
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    });
  } catch (cause) {
    throw new Error(
      "migration が失敗した。失敗した文は、同じ SQL を docker compose exec -T test_db psql -U postgres -d taimei_test で BEGIN; … ROLLBACK; して見る。migration を作り直した時は docker compose rm -sf test_db で test_db を空にしてから流し直す",
      { cause },
    );
  }
}

export async function teardown() {
  console.log("🧹 Test database teardown complete");
}

async function runSql(text: string) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

async function waitForDb(maxRetries = 10, delayMs = 1000) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      console.log(`Waiting for test_db... (${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(
    "Test database not available: docker compose up -d test_db --wait で起こす",
  );
}
