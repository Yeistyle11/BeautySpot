const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: __dirname });

/** @type {import('jest').Config} */
const config = {
  displayName: "frontend",
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: ["src/lib/**/*.ts", "!src/lib/**/*.d.ts"],
  coverageDirectory: "coverage",
};

module.exports = createJestConfig(config);
