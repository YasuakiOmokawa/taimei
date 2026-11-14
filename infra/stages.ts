import { basename } from "node:path";
import type { Env } from "../src/app";
import { readWranglerConfig, type WranglerConfig } from "./wrangler-config";

type BindingKind =
  | "hyperdrive"
  | "durable_object_namespace"
  | "version_metadata"
  | "service"
  | "plain_text"
  | "secret"
  | "local_only";

export const AUTH_SERVICE_BINDING = "AUTH";

const ENV_BINDINGS = {
  HYPERDRIVE: "hyperdrive",
  COMPANY_TEAM_LIST: "durable_object_namespace",
  CF_VERSION_METADATA: "version_metadata",
  [AUTH_SERVICE_BINDING]: "service",
  AUTH_URL: "plain_text",
  AUTH_SERVICE_KEY: "secret",
  SENTRY_DSN: "secret",
  AUTH_SERVICE_URL: "local_only",
} as const satisfies Record<keyof Env, BindingKind>;

type EnvBindingOf<Kind extends BindingKind> = {
  [Name in keyof typeof ENV_BINDINGS]: (typeof ENV_BINDINGS)[Name] extends Kind
    ? Name
    : never;
}[keyof typeof ENV_BINDINGS];

const envBindingsOf = <Kind extends BindingKind>(kind: Kind) =>
  Object.entries(ENV_BINDINGS)
    .filter(([, declared]) => declared === kind)
    .map(([name]) => name) as EnvBindingOf<Kind>[];

type ServedAt =
  | { readonly kind: "customDomain"; readonly domain: string }
  | { readonly kind: "workersDevBehindAccess" };

type StageSecrets = {
  readonly type: "secrets_store_secret" | "secret_text";
  readonly bound: Readonly<Record<EnvBindingOf<"secret">, boolean>>;
};

type StageVars = Readonly<Record<EnvBindingOf<"plain_text">, string>>;

export type StageConfig = {
  readonly workerName: string;
  readonly hyperdriveName: string;
  readonly authWorkerName: string;
  readonly entry: string;
  readonly servedAt: ServedAt;
  readonly secrets: StageSecrets;
  readonly vars: StageVars;
};

const WORKERS_DEV_SUBDOMAIN = "taimei-staging";

const workersDevUrl = (workerName: string) =>
  `https://${workerName}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;

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

const isStageVars = (
  vars: Readonly<Record<string, string>>,
): vars is StageVars =>
  Object.keys(vars).sort().join() === envBindingsOf("plain_text").sort().join();

const stageVarsOf = (config: WranglerConfig): StageVars => {
  if (isStageVars(config.vars)) return config.vars;
  throw new Error(
    `wrangler.jsonc の vars は ${envBindingsOf("plain_text").join("・")} だけにする (今は ${Object.keys(config.vars).join("・")})。足す binding は src/app.ts の Env と infra/stages.ts の ENV_BINDINGS にも足す`,
  );
};

export const productionStageOf = (config: WranglerConfig): StageConfig => ({
  workerName: config.name,
  hyperdriveName: "taimei",
  authWorkerName: authWorkerNameOf(config),
  entry: config.main,
  servedAt: { kind: "customDomain", domain: customDomainOf(config) },
  secrets: {
    type: "secret_text",
    bound: { AUTH_SERVICE_KEY: true, SENTRY_DSN: true },
  },
  vars: stageVarsOf(config),
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
    secrets: {
      type: "secrets_store_secret",
      bound: { AUTH_SERVICE_KEY: true, SENTRY_DSN: false },
    },
    vars: { AUTH_URL: workersDevUrl(STAGING_AUTH_WORKER_NAME) },
  },
  production: productionStageOf(productionWranglerConfig),
};

export const STATE_STORE_WORKER_NAME = "alchemy-state-store-taimei";

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

export const boundSecretsOf = ({ secrets }: StageConfig) =>
  envBindingsOf("secret").filter((name) => secrets.bound[name]);

const expectedBindings = (stage: StageConfig): WorkerBinding[] => [
  { name: "ASSETS", type: "assets" },
  ...Object.entries(ENV_BINDINGS)
    .filter(([, kind]) => kind !== "secret" && kind !== "local_only")
    .map(([name, type]) => ({ name, type })),
  ...boundSecretsOf(stage).map((name) => ({ name, type: stage.secrets.type })),
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
