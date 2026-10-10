import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: import.meta.dirname,
  resolve: {
    alias: { "@": path.join(import.meta.dirname, "src") },
  },
});
