// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Node build scripts (asset cropping etc.).
    files: ["scripts/**/*.cjs"],
    languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable", process: "readonly", console: "readonly" } },
  },
  {
    rules: {
      // Mount flags ("no roll on the first render"), debounced checks and cache cleanup set state from effects on
      // purpose; flagged as a warning to keep an eye on, not an error.
      "react-hooks/set-state-in-effect": "warn",
      // Backend contracts (@api/*) are type-only: the app bundle must never import backend code.
      "no-restricted-imports": ["error", { patterns: [{ group: ["@api/*"], allowTypeImports: true, message: "Backend contracts are types only: use `import type`." }] }],
    },
  },
]);
