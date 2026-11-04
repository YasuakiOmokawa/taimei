import { spawnSync } from "node:child_process";
import { parseStage } from "./stages";

const EFFECT_LOG_PREFIX =
  /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] [A-Z]+ \(#\d+\)(?: [^:]+)?: /;
const OPERATION_LINE = /^\s*(\[[^\]]+\]\s+(\S+))(?:\s.*)?$/;
const IN_SYNC_OPERATIONS = new Set(["noop", "unchanged"]);
const NO_CHANGES = /\bno changes\b/i;

const DEFINITION = "infra/alchemy.run.ts";

export const differingOperationLines = (output: string): string[] => {
  const operations = output.split("\n").flatMap((line) => {
    const match = OPERATION_LINE.exec(line.replace(EFFECT_LOG_PREFIX, ""));
    return match?.[1] && match[2]
      ? [{ line: match[1], operation: match[2] }]
      : [];
  });
  if (operations.length === 0 && !NO_CHANGES.test(output)) {
    throw new Error(
      "alchemy の出力に操作の行も no changes も無い (出力の形が変わった)",
    );
  }
  return operations
    .filter(({ operation }) => !IN_SYNC_OPERATIONS.has(operation))
    .map(({ line }) => line);
};

const ALCHEMY_TIMEOUT_MS = 10 * 60 * 1000;

const runAlchemy = (args: readonly string[], stage: string): string => {
  const result = spawnSync(
    "bunx",
    ["alchemy", ...args, "--stage", stage, "--no-input"],
    {
      encoding: "utf8",
      timeout: ALCHEMY_TIMEOUT_MS,
      env: { ...process.env, NO_COLOR: "1", ALCHEMY_TELEMETRY_DISABLED: "1" },
    },
  );
  if (result.error) throw result.error;
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status !== 0) {
    console.error(output);
    throw new Error(`alchemy ${args[0]} exited with ${result.status}`);
  }
  return output;
};

if (import.meta.main) {
  const stage = parseStage(process.argv[2] ?? "");
  const differences = [
    ...differingOperationLines(runAlchemy(["plan", DEFINITION], stage)),
    ...differingOperationLines(
      runAlchemy(["drift", "--config", DEFINITION], stage),
    ),
  ];
  for (const difference of differences) console.error(`DRIFT: ${difference}`);
  if (differences.length > 0) process.exit(1);
}
