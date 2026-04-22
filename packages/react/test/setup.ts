import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { beforeAll, expect, vi } from "vitest";

expect.extend(matchers);

beforeAll(() => {
  // jsdom doesn't implement ImageData; provide a minimal shim for canvas-based components.
  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    } as unknown as typeof ImageData;
  }

  const context2D = {
    measureText: () => ({
      width: 0,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 0,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0,
    }),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeRect: vi.fn(),
  };

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => context2D),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    value: vi.fn(() => "data:image/png;base64,AAAA"),
  });
});
