type StageConfig = {
  readonly workerName: string;
  readonly hyperdriveName: string;
  readonly authWorkerName: string;
};

const WORKERS_DEV_SUBDOMAIN = "taimei-staging";

const workersDevUrl = (workerName: string) =>
  `https://${workerName}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;

export const STAGES = {
  staging: {
    workerName: "taimei-staging",
    hyperdriveName: "taimei-staging",
    authWorkerName: "taimei-auth-staging",
  },
} as const satisfies Record<string, StageConfig>;

type StageName = keyof typeof STAGES;

export const varsOf = (stage: StageConfig) => ({
  AUTH_URL: workersDevUrl(stage.authWorkerName),
});

const isStageName = (name: string): name is StageName =>
  Object.hasOwn(STAGES, name);

export const parseStage = (name: string): StageName => {
  if (isStageName(name)) return name;
  throw new Error(
    `stage "${name}" は infra/stages.ts の表に無い (${Object.keys(STAGES).join(" / ")})`,
  );
};

export const parseAccountId = (value: string | undefined): string => {
  if (value) return value;
  throw new Error(
    "CLOUDFLARE_ACCOUNT_ID が無い (Access の開発者の policy はこのアカウントのメンバーに絞る)",
  );
};
