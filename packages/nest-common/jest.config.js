module.exports = {
  preset: "ts-jest",
  setupFiles: ["<rootDir>/test-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(uuid|glob|path-scurry|lru-cache|minipass|rimraf|brace-expansion|@nestjs|@nestjs|@golevelup))",
  ],
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.spec.ts",
    "!src/**/*.interface.ts",
  ],
  coverageDirectory: "coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@beautyspot/database$": "<rootDir>/../database/src",
    "^@beautyspot/shared-types$": "<rootDir>/../shared-types/src",
    "^@beautyspot/shared-utils$": "<rootDir>/../shared-utils/src",
    "^@beautyspot/event-types$": "<rootDir>/../event-types/src",
    "^@beautyspot/shared-constants$": "<rootDir>/../shared-constants/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
};
