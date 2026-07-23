const isDev = process.env.NODE_ENV !== "production";

// Para errores de negocio ya manejados (formularios, mutaciones fallidas):
// util de depuracion en desarrollo, silencioso en produccion. Los error
// boundaries (app/error.tsx, app/global-error.tsx, etc.) usan console.error
// directo a proposito -- esos SI deben sobrevivir en produccion (ver
// next.config.js: removeConsole.exclude: ["error"]).
export const logger = {
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  // Este modulo es el envoltorio permitido de console; la regla no-console
  // aplica al resto del codigo, no aqui.
  log: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log(...args);
  },
};
