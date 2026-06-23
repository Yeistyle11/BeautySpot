module.exports = {
  setupFiles: ["<rootDir>/../../packages/nest-common/test-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  transformIgnorePatterns: ["node_modules/(?!(uuid|@nestjs|@golevelup))"],
  collectCoverageFrom: ["**/*.(t|j)s", "!**/*.spec.ts", "!**/*.interface.ts"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@beautyspot/database$": "<rootDir>/../../packages/database/src",
    "^@beautyspot/shared-types$": "<rootDir>/../../packages/shared-types/src",
    "^@beautyspot/shared-utils$": "<rootDir>/../../packages/shared-utils/src",
    "^@beautyspot/event-types$": "<rootDir>/../../packages/event-types/src",
    "^@beautyspot/shared-constants$":
      "<rootDir>/../../packages/shared-constants/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
};
