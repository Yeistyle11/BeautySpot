module.exports = {
  displayName: "frontend",
  rootDir: ".",
  testEnvironment: "jsdom",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["<rootDir>/src/**/*.test.(ts|tsx)"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          module: "commonjs",
          target: "es2017",
          lib: ["dom", "dom.iterable", "es2017"],
          moduleResolution: "node",
          skipLibCheck: true,
          strict: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|sass|scss)$": "<rootDir>/src/__mocks__/styleMock.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  collectCoverageFrom: [
    "src/components/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};
