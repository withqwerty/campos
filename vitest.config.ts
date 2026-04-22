import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./packages/react/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@withqwerty/campos-schema": resolve(rootDir, "packages/schema/src/index.ts"),
      "@withqwerty/campos-adapters": resolve(rootDir, "packages/adapters/src/index.ts"),
      "@withqwerty/campos-react": resolve(rootDir, "packages/react/src/index.ts"),
      "@withqwerty/campos-static": resolve(rootDir, "packages/static/src/index.tsx"),
      "@withqwerty/campos-stadia": resolve(rootDir, "packages/stadia/src/index.ts"),
    },
  },
});
