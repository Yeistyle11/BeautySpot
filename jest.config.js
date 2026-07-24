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
  // statements, lines y functions ya cumplen/superan el objetivo de 80%;
  // branches queda en 76 como piso anti-regresión, a subir a 80 con más tests.
  coverageThreshold: {
    global: {
      statements: 90,
      lines: 91,
      functions: 80,
      branches: 76,
    },
  },
};
