const eslint = require("@eslint/js");
const globals = require("globals");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
  {
    ignores: [
      "node_modules/",
      "tokens/",
      "backups/",
      "logs/",
      "coverage/",
      "dist/",
      "build/",
      "migrations/",
      "seeders/",
      "scripts/",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: 2024,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "error",
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.test.js", "tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ["src/utils/logger.js"],
    rules: {
      "no-console": "off",
    },
  },
  eslint.configs.recommended,
  prettierConfig,
];
