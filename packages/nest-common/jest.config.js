const path = require("path");

module.exports = {
  setupFiles: ["<rootDir>/../test-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  transformIgnorePatterns: ["node_modules/(?!(uuid))"],
  collectCoverageFrom: ["**/*.(t|j)s", "!**/*.spec.ts", "!**/*.interface.ts"],
  coverageDirectory: "../coverage",
  coverageReporters: ["json", "lcov", "text", "clover"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testEnvironment: "node",
  moduleNameMapper: {
    "^uuid$": "uuid",
    "^@beautyspot/database$": "<rootDir>/../../database/src",
    "^@beautyspot/shared-types$": "<rootDir>/../../shared-types/src",
    "^@beautyspot/shared-utils$": "<rootDir>/../../shared-utils/src",
    "^@beautyspot/event-types$": "<rootDir>/../../event-types/src",
    "^@beautyspot/shared-constants$": "<rootDir>/../../shared-constants/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
  verbose: true,
};
