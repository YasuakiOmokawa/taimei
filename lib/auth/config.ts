import "server-only";

const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3100";
const serviceKey = process.env.AUTH_SERVICE_KEY;

export const authClientConfig = {
  baseUrl: `${authServiceUrl}/rpc`,
  serviceKey,
} as const;
