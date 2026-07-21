import "@testing-library/jest-dom";

// jsdom no implementa scrollIntoView — lo mockeamos como no-op
window.HTMLElement.prototype.scrollIntoView = function () {};
