// Extiende la configuracion del monorepo con las reglas de Next, que solo
// tienen sentido aqui: son las unicas paginas y componentes del repositorio.
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const raiz = require("../../eslint.config.js");

module.exports = [
  ...raiz,
  ...nextCoreWebVitals,
  {
    rules: {
      // En el frontend `any` solo avisa: las plantillas y los tipos de React
      // obligan a algun hueco puntual que no compensa perseguir.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
