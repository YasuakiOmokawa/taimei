import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const lineStartingWith = (path: string, prefix: string) => {
  const line = readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(prefix));
  if (line === undefined) throw new Error(`${path} に ${prefix} の行が無い`);
  return line;
};

const wranglerDev = lineStartingWith("scripts/wrangler-dev.sh", "exec ");

it("wrangler dev は bun の上では要求に応答せず、bunx は node が無いと bun で動かすので、node で wrangler.js を直に起動する", () => {
  expect(wranglerDev).toMatch(
    /^exec node node_modules\/wrangler\/bin\/wrangler\.js dev /,
  );
});

it("wrangler dev に --local-upstream を渡す (無いと routes の host app.taimei-code.com が request.url と Origin になり、手元の URL と食い違う)", () => {
  expect(wranglerDev).toContain("--local-upstream ");
});

it("--env-file は値を複数とり後ろの引数も env file として読むので、wrangler dev の最後の引数に置く", () => {
  expect(wranglerDev).toMatch(/ --env-file "\$env_file"$/);
});

it("qa:down の pkill は、port 3000 を持つ workerd の親として残る wrangler (node) の command line に当たる", () => {
  const [, pattern] =
    lineStartingWith("scripts/qa-serve.sh", "pkill -f ").match(
      /^pkill -f "([^"]+)"/,
    ) ?? [];
  const commandLine = wranglerDev
    .replace(/^exec /, "")
    .replace('"$@" ', "")
    .replaceAll('"$port"', "3000");

  expect(pattern).toBeDefined();
  expect(commandLine).toMatch(new RegExp(`${pattern}`));
});
