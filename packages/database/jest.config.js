module.exports = {
  setupFiles: ["<rootDir>/../../packages/nest-common/test-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/*.spec.ts",
    "!**/*.entity.ts",
    "!**/*.interface.ts",
  ],
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
    "^@beautyspot/shared-types$": "<rootDir>/../../packages/shared-types/src",
    "^@beautyspot/shared-utils$": "<rootDir>/../../packages/shared-utils/src",
    "^@beautyspot/event-types$": "<rootDir>/../../packages/event-types/src",
    "^@beautyspot/shared-constants$":
      "<rootDir>/../../packages/shared-constants/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
  verbose: true,
};
