/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js", "**/tests/**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/setup.js"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}],
    "^.+\\.jsx?$": "babel-jest",
  },
};
