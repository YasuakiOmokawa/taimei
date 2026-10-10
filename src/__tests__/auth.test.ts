import { afterEach, describe, expect, it, vi } from "vitest";
import { type AuthEnv, verifySession } from "../auth";

const sessionNotFound = () =>
  Response.json({ error: { reason: "RESULT_SESSION_NOT_FOUND" } });

const bindingEnv = (env: Partial<AuthEnv> = {}) => {
  const binding = vi.fn<typeof fetch>(async () => sessionNotFound());
  return {
    binding,
    env: {
      AUTH: { fetch: binding },
      AUTH_URL: "https://auth.example",
      ...env,
    },
  };
};

const cookie = "better-auth.session_token=tok";

const sentRequest = (spy: ReturnType<typeof vi.fn<typeof fetch>>) => {
  const [input, init] = spy.mock.calls[0];
  return { url: String(input), init: init ?? {} };
};

afterEach(() => vi.unstubAllGlobals());

describe("verifySession", () => {
  it("AUTH_SERVICE_URL が無ければ、binding に VerifySession を POST する", async () => {
    const { binding, env } = bindingEnv();

    await verifySession(env, cookie);

    expect(binding).toHaveBeenCalledOnce();
    const { url, init } = sentRequest(binding);
    expect(new URL(url).pathname).toBe(
      "/rpc/auth.v1.AuthService/VerifySession",
    );
    expect(init.method).toBe("POST");
  });

  it("AUTH_SERVICE_URL があれば、その URL へ global の fetch で送り、binding を呼ばない", async () => {
    const global = vi.fn<typeof fetch>(async () => sessionNotFound());
    vi.stubGlobal("fetch", global);
    const { binding, env } = bindingEnv({
      AUTH_SERVICE_URL: "http://auth.local:3100",
    });

    await verifySession(env, cookie);

    expect(sentRequest(global).url).toBe(
      "http://auth.local:3100/rpc/auth.v1.AuthService/VerifySession",
    );
    expect(binding).not.toHaveBeenCalled();
  });

  it("AUTH_SERVICE_KEY があれば X-Service-Key で送る", async () => {
    const { binding, env } = bindingEnv({ AUTH_SERVICE_KEY: "key-1" });

    await verifySession(env, cookie);

    expect(
      new Headers(sentRequest(binding).init.headers).get("X-Service-Key"),
    ).toBe("key-1");
  });

  it("AUTH_SERVICE_KEY が無ければ X-Service-Key を送らない", async () => {
    const { binding, env } = bindingEnv();

    await verifySession(env, cookie);

    expect(
      new Headers(sentRequest(binding).init.headers).has("X-Service-Key"),
    ).toBe(false);
  });

  it("redirect を manual にして送る", async () => {
    const { binding, env } = bindingEnv();

    await verifySession(env, cookie);

    expect(sentRequest(binding).init.redirect).toBe("manual");
  });

  it("10 秒で打ち切る", async () => {
    const { binding, env } = bindingEnv();

    await verifySession(env, cookie);

    expect(
      new Headers(sentRequest(binding).init.headers).get("Connect-Timeout-Ms"),
    ).toBe("10000");
  });
});
