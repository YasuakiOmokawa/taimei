import { describe, expect, it } from "vitest";
import { parseAccountId, parseStage, STAGES, varsOf } from "../stages";
import { readWranglerConfig } from "../wrangler-config";

const production = readWranglerConfig();
const stages = Object.entries(STAGES);

describe("staging の表は、本番の Worker と auth を名指せない", () => {
  it.each(stages)(
    "%s の Worker の名前は本番の Worker の名前と違う",
    (_, stage) => {
      expect(stage.workerName).not.toBe(production.name);
    },
  );

  it.each(stages)(
    "%s の auth の Worker の名前は、本番の Service Binding の先と違う",
    (_, stage) => {
      expect(production.services.map(({ service }) => service)).not.toContain(
        stage.authWorkerName,
      );
    },
  );

  it.each(stages)(
    "%s の vars の key は wrangler.jsonc の vars の key と同じ (AUTH_SERVICE_URL を足すと Service Binding を通らずに公開 URL へ届く)",
    (_, stage) => {
      expect(Object.keys(varsOf(stage)).sort()).toEqual(
        Object.keys(production.vars).sort(),
      );
    },
  );

  it("staging の AUTH_URL は taimei-auth の staging の workers.dev の URL", () => {
    expect(varsOf(STAGES.staging).AUTH_URL).toBe(
      "https://taimei-auth-staging.taimei-staging.workers.dev",
    );
  });
});

describe("IaC の CLI の入力は、表に無い値で止まる", () => {
  it.each(["production", "", "Staging"])(
    "stage %j は表に無いので失敗する",
    (name) => {
      expect(() => parseStage(name)).toThrow();
    },
  );

  it("stage staging は通る", () => {
    expect(parseStage("staging")).toBe("staging");
  });

  it.each([undefined, ""])(
    "アカウントの ID %j は失敗する (Access の開発者の policy をどのアカウントのメンバーにも絞れない)",
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
