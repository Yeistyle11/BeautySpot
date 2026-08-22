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
      // Avisa, no bloquea. La regla llego con las reglas de React 19 y marca
      // siete sitios que sincronizan estado desde un efecto, anteriores a
      // ella: la pagina de una lista al cambiar de filtro, el tema al montar,
      // el menu lateral al navegar, la galeria del escaparate y los dos pasos
      // de reserva. Cada uno se arregla derivando el valor o remontando por
      // key, pero son cambios de comportamiento en flujos de cobro y reserva,
      // no parte de subir de version. Que quede a la vista hasta entonces.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
