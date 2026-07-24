module.exports = {
  rootDir: ".",
  projects: [
    "<rootDir>/apps/frontend",
    "<rootDir>/packages/shared-utils",
    "<rootDir>/packages/database",
    "<rootDir>/packages/nest-common",
    "<rootDir>/services/core-service",
    "<rootDir>/services/auth-service",
    "<rootDir>/services/booking-service",
    "<rootDir>/services/payment-service",
    "<rootDir>/services/marketplace-service",
    "<rootDir>/services/notification-service",
    "<rootDir>/services/analytics-service",
    "<rootDir>/services/api-gateway",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["json", "lcov", "text", "clover"],
  // Umbral de cobertura obligatorio (falla el CI si baja).
  // statements y lines ya superan el objetivo de 80%; branches y functions
  // fijan un piso anti-regresión que se irá subiendo hasta 80% conforme se
  // añaden tests (ver tests de integración en docker-compose.test.yml).
  coverageThreshold: {
    global: {
      statements: 85,
      lines: 86,
      functions: 76,
      branches: 68,
    },
  },
};
