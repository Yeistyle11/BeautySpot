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
