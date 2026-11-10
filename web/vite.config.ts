import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  const { foldkit } = await import("@foldkit/vite-plugin");
  return {
    plugins: [react(), foldkit({ devToolsMcpPort: false })],
    root: import.meta.dirname,
    resolve: {
      alias: { "@": path.join(import.meta.dirname, "src") },
    },
  };
});
