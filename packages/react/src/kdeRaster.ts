import { kdeGridToRGBA, type ColorStop, type KDEModel } from "./compute/index.js";

/**
 * KDE currently renders through a browser canvas before embedding the result
 * back into the pitch SVG as an <image>. This seam is intentionally local to
 * the interactive/browser renderer and is not yet the shared static/export-safe
 * contract used by the other pitch overlays.
 */
export type KDERasterData = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

export function buildKDERasterData(
  model: KDEModel,
  colorStops: readonly ColorStop[],
  opacity = 1,
): KDERasterData | null {
  const { gridWidth, gridHeight } = model.density;
  if (gridWidth === 0 || gridHeight === 0) return null;

  const pixels = kdeGridToRGBA(model, colorStops, opacity);
  const direction = model.meta.attackingDirection;
  const isVertical = direction === "up" || direction === "down";

  if (!isVertical) {
    return {
      width: gridWidth,
      height: gridHeight,
      pixels: new Uint8ClampedArray(pixels),
    };
  }

  // Raster orientation must mirror the Pitch projection for the same
  // attackingDirection. See packages/stadia/src/transforms/pitch-transform.ts.
  //
  //   "up":   svgX = (100 - camposY) · width; svgY = (100 - camposX) · length
  //           ⇒ dstCol = (gridHeight - 1) - row  (camposY=0 → raster right)
  //           ⇒ dstRow = (gridWidth  - 1) - col  (camposX=100 → raster top)
  //
  //   "down": svgX =        camposY  · width; svgY =        camposX  · length
  //           ⇒ dstCol = row                   (camposY=0 → raster left)
  //           ⇒ dstRow = col                   (camposX=100 → raster bottom)
  const isUp = direction === "up";
  const width = gridHeight;
  const height = gridWidth;
  const orientedPixels = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const srcIdx = (row * gridWidth + col) * 4;
      const dstCol = isUp ? gridHeight - 1 - row : row;
      const dstRow = isUp ? gridWidth - 1 - col : col;
      const dstIdx = (dstRow * width + dstCol) * 4;
      orientedPixels[dstIdx] = pixels[srcIdx] ?? 0;
      orientedPixels[dstIdx + 1] = pixels[srcIdx + 1] ?? 0;
      orientedPixels[dstIdx + 2] = pixels[srcIdx + 2] ?? 0;
      orientedPixels[dstIdx + 3] = pixels[srcIdx + 3] ?? 0;
    }
  }

  return { width, height, pixels: orientedPixels };
}

export function rasterToCanvasDataURL(
  raster: KDERasterData,
  doc: Document = document,
): string | null {
  const canvas = doc.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(raster.pixels), raster.width, raster.height),
    0,
    0,
  );
  return canvas.toDataURL("image/png");
}

export function densityToDataURL(
  model: KDEModel,
  colorStops: readonly ColorStop[],
  opacity = 1,
  doc: Document = document,
): string | null {
  const raster = buildKDERasterData(model, colorStops, opacity);
  if (raster == null) return null;
  return rasterToCanvasDataURL(raster, doc);
}
