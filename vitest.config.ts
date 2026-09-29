import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["packs/**/*.test.ts", "lib/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    environment: "node",
  },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
