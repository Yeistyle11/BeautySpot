import "@testing-library/jest-dom";

// jsdom no implementa ResizeObserver y los primitivos de Radix que miden su
// contenido —el interruptor, entre otros— lo piden al montarse.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Tampoco implementa matchMedia. Por defecto se responde como una pantalla de
// escritorio; las pruebas de movil sustituyen la funcion por la suya.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
