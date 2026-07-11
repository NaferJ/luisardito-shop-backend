const eslint = require("@eslint/js");
const globals = require("globals");
const prettierConfig = require("eslint-config-prettier");
const tseslint = require("typescript-eslint");

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
  eslint.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-unused-vars": [
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
    files: [
      "tests/**/*.test.js",
      "tests/**/*.js",
      "tests/**/*.test.ts",
      "tests/**/*.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ["src/utils/logger.js", "src/utils/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  prettierConfig,
];
