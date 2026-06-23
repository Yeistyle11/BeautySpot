module.exports = {
  preset: "ts-jest",
  setupFiles: ["<rootDir>/../../packages/nest-common/test-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\.spec\.ts$",
  transform: {
    "^.+\.(t|j)s$": "ts-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(uuid|glob|path-scurry|lru-cache|minipass|rimraf|brace-expansion|@nestjs|@nestjs|@golevelup|@beautyspot))",
  ],
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/*.interface.ts",
    "!src/**/main.ts",
    "!src/**/common/**",
  ],
  coverageDirectory: "coverage",
  testEnvironment: "node",
  moduleDirectories: ["node_modules", "<rootDir>/../../node_modules"],
  moduleNameMapper: {
    "^@beautyspot/database$": "<rootDir>/../../packages/database/src",
    "^@beautyspot/shared-types$":
      "<rootDir>/../../packages/shared-types/src",
    "^@beautyspot/shared-utils$":
      "<rootDir>/../../packages/shared-utils/src",
    "^@beautyspot/event-types$": "<rootDir>/../../packages/event-types/src",
    "^@beautyspot/shared-constants$":
      "<rootDir>/../../packages/shared-constants/src",
    "^@beautyspot/nest-common$": "<rootDir>/../../packages/nest-common/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
};
