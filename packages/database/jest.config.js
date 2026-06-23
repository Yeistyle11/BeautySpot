module.exports = {
  setupFiles: ["<rootDir>/../nest-common/test-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.spec.ts",
    "!src/**/*.entity.ts",
    "!src/**/*.interface.ts",
  ],
  coverageDirectory: "coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@beautyspot/shared-types$": "<rootDir>/../shared-types/src",
    "^@beautyspot/shared-utils$": "<rootDir>/../shared-utils/src",
    "^@beautyspot/event-types$": "<rootDir>/../event-types/src",
    "^@beautyspot/shared-constants$": "<rootDir>/../shared-constants/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
};
