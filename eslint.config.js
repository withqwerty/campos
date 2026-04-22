import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default defineConfig([
  // ── Global ignores ──────────────────────────────────────────────
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "packages/schema/src/generated.*",
      "packages/schema/src/index.js",
      "packages/schema/src/index.d.ts",
      "packages/schema/scripts/",
      "packages/static/test/fixtures/export-fixtures.js",
      "packages/static/test/fixtures/generate-static-fixtures.mjs",
      "eslint.config.js",
      "apps/*/.astro/",
      "apps/*/scripts/",
      "scripts/",
    ],
  },

  // ── Base: JS recommended ────────────────────────────────────────
  js.configs.recommended,

  // ── JS/MJS/CJS config files: Node/web globals ──────────────────
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: {
        URL: "readonly",
        URLSearchParams: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        globalThis: "readonly",
      },
    },
  },

  // ── TypeScript: strict type-aware rules (TS/TSX only) ──────────
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
    },
  },

  // ── React hooks (TSX files only) ───────────────────────────────
  {
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // ── Test files: relax strict rules ─────────────────────────────
  {
    files: ["**/test/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // ── Prettier: must be last (disables conflicting format rules) ─
  prettier,
]);
