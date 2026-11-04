import { describe, expect, it } from "vitest";
import { servingVersionIds, workerMismatches } from "../check-worker";

const settings = (
  bindings: { name: string; type: string }[],
  overrides: { workersDev?: boolean; observability?: boolean } = {},
) => ({ bindings, workersDev: false, observability: true, ...overrides });

const AUTH_URL = { name: "AUTH_URL", type: "plain_text" };
const SENTRY_DSN = { name: "SENTRY_DSN", type: "secret_text" };

describe("Worker の今の設定と定義の期待を比べる", () => {
  it("同じなら差は無い", () => {
    expect(
      workerMismatches(settings([AUTH_URL]), settings([AUTH_URL])),
    ).toEqual([]);
  });

  it("dashboard で足した var のように、期待に無い binding を報告する", () => {
    expect(
      workerMismatches(settings([AUTH_URL, SENTRY_DSN]), settings([AUTH_URL])),
    ).toEqual(["SENTRY_DSN (secret_text) is live but not declared"]);
  });

  it("gate の deploy で落ちた secret のように、今の設定に無い期待の binding を報告する", () => {
    expect(
      workerMismatches(settings([AUTH_URL]), settings([AUTH_URL, SENTRY_DSN])),
    ).toEqual(["SENTRY_DSN (secret_text) is declared but not live"]);
  });

  it("名前が同じで種類が違う binding を、両側の差として報告する", () => {
    expect(
      workerMismatches(
        settings([{ name: "SENTRY_DSN", type: "secrets_store_secret" }]),
        settings([SENTRY_DSN]),
      ),
    ).toEqual([
      "SENTRY_DSN (secrets_store_secret) is live but not declared",
      "SENTRY_DSN (secret_text) is declared but not live",
    ]);
  });

  it("workers.dev と observability の違いを報告する", () => {
    expect(
      workerMismatches(
        settings([], { workersDev: true, observability: false }),
        settings([]),
      ),
    ).toEqual([
      "workers.dev is true but declared false",
      "observability is false but declared true",
    ]);
  });

  it("取り込みで alchemy が足す ALCHEMY_ の binding は比べない", () => {
    expect(
      workerMismatches(
        settings([AUTH_URL, { name: "ALCHEMY_STACK", type: "plain_text" }]),
        settings([AUTH_URL]),
      ),
    ).toEqual([]);
  });
});

describe("比べる version", () => {
  it("最新の deployment に入っている version をすべて比べる (settings は最新の upload しか返さない)", () => {
    expect(
      servingVersionIds([
        { versions: [{ version_id: "new" }, { version_id: "current" }] },
        { versions: [{ version_id: "old" }] },
      ]),
    ).toEqual(["new", "current"]);
  });

  it("deployment が無ければ失敗する", () => {
    expect(() => servingVersionIds([])).toThrow();
  });
});
