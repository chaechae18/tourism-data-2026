import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe() {}

  disconnect() {}
}

const canvasContext = {
  arc() {},
  beginPath() {},
  fill() {},
  fillRect() {},
  fillText() {},
  lineTo() {},
  moveTo() {},
  restore() {},
  rotate() {},
  save() {},
  stroke() {},
  strokeText() {},
  translate() {},
};

Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });
Object.defineProperty(globalThis, "requestAnimationFrame", { value: () => 1, writable: true });
Object.defineProperty(globalThis, "cancelAnimationFrame", { value: () => {}, writable: true });
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: () => canvasContext, writable: true });
