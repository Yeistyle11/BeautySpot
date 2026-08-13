module.exports = {
  rootDir: ".",
  projects: [
    "<rootDir>/apps/frontend",
    "<rootDir>/packages/shared-utils",
    "<rootDir>/packages/shared-constants",
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
  // Umbral de cobertura obligatorio (falla el CI si baja). Las cuatro métricas
  // superan ya el objetivo del 80%; los valores son pisos anti-regresión,
  // fijados un poco por debajo de la medición real para no romper el CI por
  // variaciones de un par de décimas.
  coverageThreshold: {
    global: {
      statements: 92,
      lines: 93,
      functions: 80,
      branches: 80,
    },
  },
};
