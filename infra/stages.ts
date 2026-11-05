import { basename } from "node:path";
import { readWranglerConfig, type WranglerConfig } from "./wrangler-config";

type ServedAt =
  | { readonly kind: "customDomain"; readonly domain: string }
  | { readonly kind: "workersDevBehindAccess" };

type StageSecrets = {
  readonly type: "secrets_store_secret" | "secret_text";
  readonly names: readonly string[];
};

export type StageConfig = {
  readonly workerName: string;
  readonly hyperdriveName: string;
  readonly authWorkerName: string;
  readonly entry: string;
  readonly servedAt: ServedAt;
  readonly secrets: StageSecrets;
  readonly vars: Readonly<Record<string, string>>;
};

const WORKERS_DEV_SUBDOMAIN = "taimei-staging";

const workersDevUrl = (workerName: string) =>
  `https://${workerName}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;

export const AUTH_SERVICE_BINDING = "AUTH";

const authWorkerNameOf = (config: WranglerConfig) => {
  const auth = config.services.find(
    ({ binding }) => binding === AUTH_SERVICE_BINDING,
  );
  if (auth) return auth.service;
  throw new Error(
    `wrangler.jsonc の services に binding ${AUTH_SERVICE_BINDING} が無い`,
  );
};

const customDomainOf = (config: WranglerConfig) => {
  const domains = config.routes.filter(({ custom_domain }) => custom_domain);
  const [only] = domains;
  if (only && domains.length === 1) return only.pattern;
  throw new Error(
    `wrangler.jsonc の routes の custom domain は 1 つにする (今は ${domains.length} 個)`,
  );
};

export const productionStageOf = (config: WranglerConfig): StageConfig => ({
  workerName: config.name,
  hyperdriveName: "taimei",
  authWorkerName: authWorkerNameOf(config),
  entry: config.main,
  servedAt: { kind: "customDomain", domain: customDomainOf(config) },
  secrets: { type: "secret_text", names: ["AUTH_SERVICE_KEY", "SENTRY_DSN"] },
  vars: config.vars,
});

const STAGING_AUTH_WORKER_NAME = "taimei-auth-staging";

const productionWranglerConfig = readWranglerConfig();

type StageName = "staging" | "production";

export const STAGES: Readonly<Record<StageName, StageConfig>> = {
  staging: {
    workerName: "taimei-staging",
    hyperdriveName: "taimei-staging",
    authWorkerName: STAGING_AUTH_WORKER_NAME,
    entry: "testing/staging-worker.ts",
    servedAt: { kind: "workersDevBehindAccess" },
    secrets: { type: "secrets_store_secret", names: ["AUTH_SERVICE_KEY"] },
    vars: { AUTH_URL: workersDevUrl(STAGING_AUTH_WORKER_NAME) },
  },
  production: productionStageOf(productionWranglerConfig),
};

export const WORKER_OBSERVABILITY = {
  enabled: true,
  logs: { enabled: true, invocationLogs: true },
} as const;

const urlOf = ({ servedAt, workerName }: StageConfig) =>
  servedAt.kind === "customDomain"
    ? `https://${servedAt.domain}`
    : workersDevUrl(workerName);

export const bundleMainOf = (entry: string) =>
  `./bundle/${basename(entry, ".ts")}.js`;

export const stageOutputs = (stage: StageConfig) =>
  [
    `worker_name=${stage.workerName}`,
    `url=${urlOf(stage)}`,
    `auth_url=${stage.vars.AUTH_URL}`,
    `entry=${stage.entry}`,
  ].join("\n");

export type WorkerBinding = { readonly name: string; readonly type: string };

const expectedBindings = (stage: StageConfig): WorkerBinding[] => [
  { name: "ASSETS", type: "assets" },
  { name: "CF_VERSION_METADATA", type: "version_metadata" },
  { name: "HYPERDRIVE", type: "hyperdrive" },
  { name: AUTH_SERVICE_BINDING, type: "service" },
  ...productionWranglerConfig.durable_objects.bindings.map(({ name }) => ({
    name,
    type: "durable_object_namespace",
  })),
  ...Object.keys(stage.vars).map((name) => ({ name, type: "plain_text" })),
  ...stage.secrets.names.map((name) => ({ name, type: stage.secrets.type })),
];

export type WorkerSettings = {
  readonly bindings: readonly WorkerBinding[];
  readonly workersDev: boolean;
  readonly observability: boolean;
};

export const expectedWorkerSettings = (stage: StageConfig): WorkerSettings => ({
  bindings: expectedBindings(stage),
  workersDev: stage.servedAt.kind === "workersDevBehindAccess",
  observability: WORKER_OBSERVABILITY.enabled,
});

const isStageName = (name: string): name is StageName =>
  Object.hasOwn(STAGES, name);

export const parseStage = (name: string): StageName => {
  if (isStageName(name)) return name;
  throw new Error(
    `stage "${name}" は infra/stages.ts の表に無い (${Object.keys(STAGES).join(" / ")})`,
  );
};

export const stageOf = (name: string): StageConfig => STAGES[parseStage(name)];

export const parseAccountId = (value: string | undefined): string => {
  if (value) return value;
  throw new Error(
    "CLOUDFLARE_ACCOUNT_ID が無い (Cloudflare の API の宛先と、Access の開発者の policy のメンバーの範囲に使う)",
  );
};
