const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^next$|^err$|^_.*", "caughtErrorsIgnorePattern": "^_.*" }],
      "no-console": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      sourceType: "module"
    }
  }
];
