// eslint.config.js — ESLint 9 flat configuration for JsonHippo
import js from "@eslint/js";
import globals from "globals";

const unused = ["error", { argsIgnorePattern: "^_", ignoreRestSiblings: true }];

// The parse/validate path must never lean on the platform's JSON: the custom
// parser is the source of truth (docs/features/00-overview.md, Constraints).
// Tests may use JSON.parse as an oracle, so this applies to src/ only.
const noPlatformJson = [
  "error",
  { object: "JSON", property: "parse", message: "Use the JsonHippo parser, not JSON.parse." },
  { object: "JSON", property: "stringify", message: "Use formatter.js, not JSON.stringify." },
];

export default [
  {
    ignores: ["src/vendor/**", "dist/**", "build/**", "node_modules/**"],
  },

  {
    ...js.configs.recommended,
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "error",
      "no-unused-vars": unused,
    },
  },

  // ── Browser modules: jQuery is a page global ──────────────────────────────
  {
    files: ["src/js/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser, $: "readonly", jQuery: "readonly" },
    },
    rules: {
      "no-restricted-properties": noPlatformJson,
    },
  },

  // ── Pure modules: no DOM, no jQuery, so they run under `node --test` ──────
  // Only ES built-ins are defined here, so `no-undef` catches any `document`,
  // `window` or `$` that slips in.
  {
    files: [
      "src/js/parser/**/*.js",
      "src/js/smart-paste.js",
      "src/js/formatter.js",
      "src/js/json-path.js",
      "src/js/tree-search.js",
    ],
    languageOptions: {
      globals: { ...globals.es2021 },
    },
  },

  // ── Classic (non-module) script loaded in <head> ──────────────────────────
  {
    files: ["src/js/theme.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser },
    },
  },
];
