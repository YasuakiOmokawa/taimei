import { defineConfig } from "vite";

export default defineConfig(async () => {
  const { foldkit } = await import("@foldkit/vite-plugin");
  return {
    plugins: [foldkit({ devToolsMcpPort: false })],
    root: import.meta.dirname,
  };
});
