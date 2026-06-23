module.exports = {
  setupFiles: ["<rootDir>/../../../test-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/*.dto.ts",
    "!**/*.entity.ts",
    "!**/*.interface.ts",
    "!**/main.ts",
    "!**/common/**",
  ],
  coverageDirectory: "../coverage",
  coverageReporters: ["json", "lcov", "text", "clover"],
  testEnvironment: "node",
  moduleNameMapper: {
    "^@beautyspot/database$": "<rootDir>/../../../packages/database/src",
    "^@beautyspot/shared-types$":
      "<rootDir>/../../../packages/shared-types/src",
    "^@beautyspot/shared-utils$":
      "<rootDir>/../../../packages/shared-utils/src",
    "^@beautyspot/event-types$": "<rootDir>/../../../packages/event-types/src",
    "^@beautyspot/shared-constants$":
      "<rootDir>/../../../packages/shared-constants/src",
    "^@beautyspot/nest-common$": "<rootDir>/../../../packages/nest-common/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testTimeout: 10000,
  verbose: true,
};
