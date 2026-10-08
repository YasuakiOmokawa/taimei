import "server-only";
import { createConnectTransport } from "@connectrpc/connect-node";
import {
  createAuthClient,
  createServiceKeyInterceptor,
} from "@taimei-code/auth-client";
import { authClientConfig } from "./config";

const interceptors = authClientConfig.serviceKey
  ? [createServiceKeyInterceptor(authClientConfig.serviceKey)]
  : [];

// Vercel Node runtime 想定で httpVersion 1.1 を指定。Edge / Workers に乗せ替える際は
// @connectrpc/connect-web に差し替え、httpVersion を省略する (ADR-007 README §3)。
// RPC を待つ間も runScopedService の transaction が DB の接続を持つので、待ち時間に上限を置く
const RPC_TIMEOUT_MS = 10_000;

const transport = createConnectTransport({
  httpVersion: "1.1",
  defaultTimeoutMs: RPC_TIMEOUT_MS,
  baseUrl: authClientConfig.baseUrl,
  interceptors,
});

export const authClient = createAuthClient({ transport });
