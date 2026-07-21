module.exports = {
  rootDir: ".",
  projects: [
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
};
