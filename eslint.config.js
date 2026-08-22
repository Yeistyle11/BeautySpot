// Configuracion de ESLint para todo el monorepo. Los servicios y los paquetes
// no traen la suya: heredan esta, que es la que corre `npm run lint` en cada
// workspace. El frontend si la extiende, en apps/frontend/eslint.config.js.
const tseslint = require("typescript-eslint");
const prettierPlugin = require("eslint-plugin-prettier");
const prettierConfig = require("eslint-config-prettier");

module.exports = tseslint.config(
  {
    // Nada de esto es codigo fuente: son artefactos de compilacion, cobertura
    // y dependencias, y analizarlos solo produce ruido.
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // En los tests, require() no es un descuido: es la unica forma de
    // reevaluar un modulo despues de mockearlo o de cambiar el entorno
    // (jest.isolateModules, jest.mock). Un import estatico se cachea y el
    // mock no llegaria a aplicarse.
    files: [
      "**/*.spec.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.int-test.ts",
      "**/test/setup.ts",
      "**/test-setup.ts",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      // Los tests usan `any` de forma legítima para construir mocks parciales
      // y castear dobles de prueba; exigir tipos completos ahí aporta poco.
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
