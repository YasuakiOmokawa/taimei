import {
  expectedWorkerSettings,
  parseAccountId,
  stageOf,
  type WorkerBinding,
  type WorkerSettings,
} from "./stages";

const ADDED_BY_ALCHEMY = "ALCHEMY_";

const keyOf = ({ name, type }: WorkerBinding) => `${name} (${type})`;

const comparedKeys = (bindings: readonly WorkerBinding[]) =>
  new Set(
    bindings
      .filter(({ name }) => !name.startsWith(ADDED_BY_ALCHEMY))
      .map(keyOf),
  );

const keysOnlyIn = (keys: Set<string>, other: Set<string>) =>
  [...keys].filter((key) => !other.has(key));

const settingMismatch = (label: string, live: boolean, expected: boolean) =>
  live === expected ? [] : [`${label} is ${live} but declared ${expected}`];

export const workerMismatches = (
  live: WorkerSettings,
  expected: WorkerSettings,
): string[] => {
  const liveKeys = comparedKeys(live.bindings);
  const expectedKeys = comparedKeys(expected.bindings);
  return [
    ...keysOnlyIn(liveKeys, expectedKeys).map(
      (key) => `${key} is live but not declared`,
    ),
    ...keysOnlyIn(expectedKeys, liveKeys).map(
      (key) => `${key} is declared but not live`,
    ),
    ...settingMismatch("workers.dev", live.workersDev, expected.workersDev),
    ...settingMismatch(
      "observability",
      live.observability,
      expected.observability,
    ),
  ];
};

type Deployment = {
  readonly versions: readonly { readonly version_id: string }[];
};

export const servingVersionIds = (
  deploymentsNewestFirst: readonly Deployment[],
): string[] => {
  const [latest] = deploymentsNewestFirst;
  if (!latest) throw new Error("deployment が無い");
  return latest.versions.map(({ version_id }) => version_id);
};

const readCloudflare = async <T>(path: string): Promise<T> => {
  if (!process.env.CLOUDFLARE_API_TOKEN)
    throw new Error("CLOUDFLARE_API_TOKEN が無い");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${parseAccountId(process.env.CLOUDFLARE_ACCOUNT_ID)}${path}`,
    {
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    },
  );
  const body = (await response.json()) as { success?: boolean; result?: T };
  if (!response.ok || !body.success || body.result === undefined)
    throw new Error(`GET ${path} returned ${response.status} without a result`);
  return body.result;
};

const readLiveSettings = async (
  workerName: string,
): Promise<Map<string, WorkerSettings>> => {
  const script = `/workers/scripts/${workerName}`;
  const [settings, subdomain, { deployments }] = await Promise.all([
    readCloudflare<{ observability?: { enabled?: boolean } | null }>(
      `${script}/settings`,
    ),
    readCloudflare<{ enabled: boolean }>(`${script}/subdomain`),
    readCloudflare<{ deployments: Deployment[] }>(`${script}/deployments`),
  ]);
  const versions = await Promise.all(
    servingVersionIds(deployments).map(
      async (versionId) =>
        [
          versionId,
          await readCloudflare<{ resources: { bindings: WorkerBinding[] } }>(
            `${script}/versions/${versionId}`,
          ),
        ] as const,
    ),
  );
  const live = new Map<string, WorkerSettings>();
  for (const [versionId, version] of versions)
    live.set(versionId, {
      bindings: version.resources.bindings,
      workersDev: subdomain.enabled,
      observability: settings.observability?.enabled ?? false,
    });
  return live;
};

if (import.meta.main) {
  const stage = stageOf(process.argv[2] ?? "");
  const expected = expectedWorkerSettings(stage);
  const mismatches = [...(await readLiveSettings(stage.workerName))].flatMap(
    ([versionId, live]) =>
      workerMismatches(live, expected).map(
        (mismatch) => `${versionId}: ${mismatch}`,
      ),
  );
  for (const mismatch of mismatches) console.error(mismatch);
  if (mismatches.length > 0) process.exit(1);
  console.log(`${stage.workerName} matches the definition`);
}
