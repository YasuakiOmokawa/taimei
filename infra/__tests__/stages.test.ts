import { describe, expect, it } from "vitest";
import {
  bundleMainOf,
  expectedWorkerSettings,
  parseAccountId,
  parseStage,
  productionStageOf,
  STAGES,
  STATE_STORE_WORKER_NAME,
  stageOutputs,
} from "../stages";
import { readWranglerConfig, readWranglerJson } from "../wrangler-config";

const production = readWranglerConfig();

const nonProductionStages = Object.entries(STAGES).filter(
  ([name]) => name !== "production",
);

describe("本番以外の stage は、本番の Worker と auth を名指せない", () => {
  it.each(nonProductionStages)(
    "%s の Worker の名前は本番の Worker の名前と違う",
    (_, stage) => {
      expect(stage.workerName).not.toBe(production.name);
    },
  );

  it.each(nonProductionStages)(
    "%s の auth の Worker の名前は、本番の Service Binding の先と違う",
    (_, stage) => {
      expect(production.services.map(({ service }) => service)).not.toContain(
        stage.authWorkerName,
      );
    },
  );

  it.each(nonProductionStages)(
    "%s の vars の key は wrangler.jsonc の vars の key と同じ (AUTH_SERVICE_URL を足すと Service Binding を通らずに公開 URL へ届く)",
    (_, stage) => {
      expect(Object.keys(stage.vars).sort()).toEqual(
        Object.keys(production.vars).sort(),
      );
    },
  );

  it("staging の AUTH_URL は taimei-auth の staging の workers.dev の URL", () => {
    expect(STAGES.staging.vars.AUTH_URL).toBe(
      "https://taimei-auth-staging.taimei-staging.workers.dev",
    );
  });
});

describe("本番の表は wrangler.jsonc から導き、値を写さない", () => {
  it("Worker の名前・入口・custom domain・auth の Worker の名前・vars は wrangler.jsonc と同じ", () => {
    expect(STAGES.production).toMatchObject({
      workerName: production.name,
      entry: production.main,
      servedAt: {
        kind: "customDomain",
        domain: production.routes[0]?.pattern,
      },
      authWorkerName: production.services.find(
        ({ binding }) => binding === "AUTH",
      )?.service,
      vars: production.vars,
    });
  });

  it.each([
    ["custom domain が無い", []],
    [
      "custom domain が 2 つある",
      [
        { pattern: "a.example.com", custom_domain: true },
        { pattern: "b.example.com", custom_domain: true },
      ],
    ],
  ])("routes に %s と、本番の表を作れない", (_, routes) => {
    expect(() => productionStageOf({ ...production, routes })).toThrow();
  });

  it("custom domain が 1 つなら、それを本番の custom domain にする", () => {
    expect(
      productionStageOf({
        ...production,
        routes: [{ pattern: "a.example.com", custom_domain: true }],
      }).servedAt,
    ).toEqual({ kind: "customDomain", domain: "a.example.com" });
  });
});

describe("wrangler.jsonc は定義が扱う設定だけを持つ", () => {
  it("top-level の key は定義か local の開発が読むものだけ (足した binding や設定は定義が宣言しないまま本番で欠ける)", () => {
    expect(Object.keys(readWranglerJson() as object).sort()).toEqual(
      [
        "assets",
        "compatibility_date",
        "compatibility_flags",
        "durable_objects",
        "hyperdrive",
        "main",
        "migrations",
        "name",
        "preview_urls",
        "routes",
        "services",
        "triggers",
        "vars",
        "version_metadata",
        "workers_dev",
      ].sort(),
    );
  });

  it("DO の migration は新しい SQLite の class だけ (改名と削除は alchemy が読まず、本番の DO を作り直す)", () => {
    const { migrations } = readWranglerJson() as {
      migrations: Record<string, unknown>[];
    };
    for (const migration of migrations)
      expect(Object.keys(migration).sort()).toEqual([
        "new_sqlite_classes",
        "tag",
      ]);
  });
});

describe("表から導く値", () => {
  it("bundle の入口は、入口の basename の .js (wrangler の dry-run の出力名)", () => {
    expect(bundleMainOf("testing/staging-worker.ts")).toBe(
      "./bundle/staging-worker.js",
    );
    expect(bundleMainOf("src/worker.ts")).toBe("./bundle/worker.js");
  });

  it("workflow が読む staging の値は Worker の名前・workers.dev の URL・auth の URL・入口の key=value の行", () => {
    expect(stageOutputs(STAGES.staging)).toBe(
      [
        "worker_name=taimei-staging",
        "url=https://taimei-staging.taimei-staging.workers.dev",
        "auth_url=https://taimei-auth-staging.taimei-staging.workers.dev",
        "entry=testing/staging-worker.ts",
      ].join("\n"),
    );
  });

  it("本番の URL は custom domain の https", () => {
    expect(stageOutputs(STAGES.production)).toContain(
      `url=https://${production.routes[0]?.pattern}\n`,
    );
  });
});

describe("drift の検出が期待する Worker の設定", () => {
  const bindingTypeByName = (stage: "staging" | "production") =>
    Object.fromEntries(
      expectedWorkerSettings(STAGES[stage]).bindings.map(({ name, type }) => [
        name,
        type,
      ]),
    );

  it("本番は custom domain だけで出し、workers.dev を無効にする", () => {
    expect(expectedWorkerSettings(STAGES.production).workersDev).toBe(false);
  });

  it("staging は Access の後ろの workers.dev で出す", () => {
    expect(expectedWorkerSettings(STAGES.staging).workersDev).toBe(true);
  });

  it("本番の secret は wrangler secret put の secret_text (100% の full deploy だけで出すので deploy で消えない)", () => {
    expect(bindingTypeByName("production")).toMatchObject({
      AUTH_SERVICE_KEY: "secret_text",
      SENTRY_DSN: "secret_text",
    });
  });

  it("staging の secret は Secrets Store の AUTH_SERVICE_KEY だけで、Sentry に送らない", () => {
    expect(bindingTypeByName("staging")).toMatchObject({
      AUTH_SERVICE_KEY: "secrets_store_secret",
    });
    expect(bindingTypeByName("staging")).not.toHaveProperty("SENTRY_DSN");
  });
});

describe("IaC の CLI の入力は、表に無い値で止まる", () => {
  it.each(["", "Staging", "Production"])(
    "stage %j は表に無いので失敗する",
    (name) => {
      expect(() => parseStage(name)).toThrow();
    },
  );

  it.each(["staging", "production"])("stage %s は通る", (name) => {
    expect(parseStage(name)).toBe(name);
  });

  it.each([undefined, ""])(
    "アカウントの ID %j は失敗する (Cloudflare の API の宛先と Access の開発者の policy をどのアカウントにも絞れない)",
    (value) => {
      expect(() => parseAccountId(value)).toThrow();
    },
  );

  it("アカウントの ID は渡した値のまま通る", () => {
    expect(parseAccountId("0123456789abcdef0123456789abcdef")).toBe(
      "0123456789abcdef0123456789abcdef",
    );
  });
});

it("state の置き場の Worker 名は、alchemy beta.84 が name の taimei から作った名前のままにする (変えると既存の state を見失い、全資源を作り直そうとする)", () => {
  expect(STATE_STORE_WORKER_NAME).toBe("alchemy-state-store-taimei");
});
