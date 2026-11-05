import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import { Effect } from "effect";
import {
  AUTH_SERVICE_BINDING,
  bundleMainOf,
  parseAccountId,
  type StageConfig,
  stageOf,
  WORKER_OBSERVABILITY,
} from "./stages";
import { readWorkerRuntime } from "./wrangler-config";

const productionWorkerRuntime = readWorkerRuntime();

const durableObjects = Object.fromEntries(
  productionWorkerRuntime.durable_objects.bindings.map(
    ({ name, class_name }) => [
      name,
      Cloudflare.DurableObject(class_name, { className: class_name }),
    ],
  ),
);

const servedAtProps = ({ workerName, servedAt }: StageConfig) =>
  servedAt.kind === "customDomain"
    ? {
        domain: servedAt.domain,
        workersDev: { enabled: false, previewsEnabled: false },
      }
    : {
        workersDev: { enabled: true, previewsEnabled: false },
        access: {
          name: workerName,
          previews: false,
          policies: [
            {
              decision: "allow" as const,
              include: [
                {
                  cloudflareAccountMember: parseAccountId(
                    process.env.CLOUDFLARE_ACCOUNT_ID,
                  ),
                },
              ],
            },
            {
              decision: "non_identity" as const,
              include: ["anyValidServiceToken" as const],
            },
          ],
        },
      };

const App = Cloudflare.Worker(
  "App",
  Effect.gen(function* () {
    const stage = stageOf(yield* Alchemy.Stage);
    return {
      name: stage.workerName,
      main: bundleMainOf(stage.entry),
      bundle: false,
      assets: {
        directory: productionWorkerRuntime.assets.directory,
        runWorkerFirst: [...productionWorkerRuntime.assets.run_worker_first],
        notFoundHandling: productionWorkerRuntime.assets.not_found_handling,
      },
      compatibility: {
        date: productionWorkerRuntime.compatibility_date,
        flags: [...productionWorkerRuntime.compatibility_flags],
      },
      crons: [...productionWorkerRuntime.triggers.crons],
      observability: WORKER_OBSERVABILITY,
      ...servedAtProps(stage),
      env: {
        ...durableObjects,
        CF_VERSION_METADATA: Cloudflare.Workers.VersionMetadata(),
        HYPERDRIVE: Cloudflare.Hyperdrive.lookup("Hyperdrive", {
          name: stage.hyperdriveName,
        }),
        ...stage.vars,
      },
    };
  }),
);

export default Alchemy.Stack(
  "Taimei",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state({ name: "taimei" }),
  },
  Effect.gen(function* () {
    const stage = stageOf(yield* Alchemy.Stage);
    const worker = yield* App;
    if (stage.secrets.type === "secrets_store_secret") {
      const store = yield* Cloudflare.SecretsStore.Store("Secrets");
      for (const name of stage.secrets.names) {
        yield* worker.bind(name, {
          bindings: [
            {
              type: "secrets_store_secret",
              name,
              secretName: name,
              storeId: store.storeId,
            },
          ],
        });
      }
    }
    yield* worker.bind(AUTH_SERVICE_BINDING, {
      bindings: [
        {
          type: "service",
          name: AUTH_SERVICE_BINDING,
          service: stage.authWorkerName,
        },
      ],
    });
    return { url: worker.url.as<string>() };
  }),
);
