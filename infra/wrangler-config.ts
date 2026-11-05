import { readFileSync } from "node:fs";
import { Schema } from "effect";

const WorkerRuntime = Schema.Struct({
  compatibility_date: Schema.String,
  compatibility_flags: Schema.Array(Schema.String),
  assets: Schema.Struct({
    directory: Schema.String,
    not_found_handling: Schema.Literals([
      "none",
      "404-page",
      "single-page-application",
    ]),
    run_worker_first: Schema.Array(Schema.String),
  }),
  durable_objects: Schema.Struct({
    bindings: Schema.Array(
      Schema.Struct({ name: Schema.String, class_name: Schema.String }),
    ),
  }),
  triggers: Schema.Struct({ crons: Schema.Array(Schema.String) }),
});

const WranglerConfig = Schema.Struct({
  ...WorkerRuntime.fields,
  name: Schema.String,
  main: Schema.String,
  services: Schema.Array(
    Schema.Struct({ binding: Schema.String, service: Schema.String }),
  ),
  routes: Schema.Array(
    Schema.Struct({ pattern: Schema.String, custom_domain: Schema.Boolean }),
  ),
  workers_dev: Schema.Boolean,
  preview_urls: Schema.Boolean,
  vars: Schema.Record(Schema.String, Schema.String),
});

const WRANGLER_CONFIG_PATH = new URL("../wrangler.jsonc", import.meta.url);

const withoutWholeLineComments = (jsonc: string) =>
  jsonc
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

export const readWranglerJson = (): unknown =>
  JSON.parse(
    withoutWholeLineComments(readFileSync(WRANGLER_CONFIG_PATH, "utf8")),
  );

export type WranglerConfig = typeof WranglerConfig.Type;

export const readWorkerRuntime = () =>
  Schema.decodeUnknownSync(WorkerRuntime)(readWranglerJson());

export const readWranglerConfig = () =>
  Schema.decodeUnknownSync(WranglerConfig)(readWranglerJson());
