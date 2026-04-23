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

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const ADLER32_MOD = 65521;
const ADLER32_NMAX = 5552;

let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crc32Table != null) {
    return crc32Table;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  crc32Table = table;
  return table;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function uint32Bytes(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i);
  }
  return bytes;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; ) {
    const chunkEnd = Math.min(i + ADLER32_NMAX, bytes.length);
    for (; i < chunkEnd; i += 1) {
      a += bytes[i] ?? 0;
      b += a;
    }
    a %= ADLER32_MOD;
    b %= ADLER32_MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = asciiBytes(type);
  const chunkBody = concatBytes([typeBytes, data]);
  return concatBytes([
    uint32Bytes(data.length),
    chunkBody,
    uint32Bytes(crc32(chunkBody)),
  ]);
}

function buildStoredZlib(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];

  for (let offset = 0; offset < data.length; ) {
    const blockLength = Math.min(0xffff, data.length - offset);
    const isFinal = offset + blockLength >= data.length;
    const header = new Uint8Array(5);
    header[0] = isFinal ? 0x01 : 0x00;
    header[1] = blockLength & 0xff;
    header[2] = (blockLength >>> 8) & 0xff;
    const nlen = ~blockLength & 0xffff;
    header[3] = nlen & 0xff;
    header[4] = (nlen >>> 8) & 0xff;
    chunks.push(header, data.subarray(offset, offset + blockLength));
    offset += blockLength;
  }

  chunks.push(uint32Bytes(adler32(data)));
  return concatBytes(chunks);
}

function buildPngScanlines(raster: KDERasterData): Uint8Array {
  const bytesPerRow = raster.width * 4 + 1;
  const scanlines = new Uint8Array(bytesPerRow * raster.height);

  for (let row = 0; row < raster.height; row += 1) {
    const rowOffset = row * bytesPerRow;
    scanlines[rowOffset] = 0;
    scanlines.set(
      raster.pixels.subarray(row * raster.width * 4, (row + 1) * raster.width * 4),
      rowOffset + 1,
    );
  }

  return scanlines;
}

function encodeBase64(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    result += BASE64_ALPHABET.charAt((triple >>> 18) & 0x3f);
    result += BASE64_ALPHABET.charAt((triple >>> 12) & 0x3f);
    result += i + 1 < bytes.length ? BASE64_ALPHABET.charAt((triple >>> 6) & 0x3f) : "=";
    result += i + 2 < bytes.length ? BASE64_ALPHABET.charAt(triple & 0x3f) : "=";
  }
  return result;
}

function rasterToPngBytes(raster: KDERasterData): Uint8Array {
  const ihdr = new Uint8Array(13);
  ihdr.set(uint32Bytes(raster.width), 0);
  ihdr.set(uint32Bytes(raster.height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const scanlines = buildPngScanlines(raster);
  const idat = buildStoredZlib(scanlines);

  return concatBytes([
    PNG_SIGNATURE,
    makePngChunk("IHDR", ihdr),
    makePngChunk("IDAT", idat),
    makePngChunk("IEND", new Uint8Array()),
  ]);
}

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
  doc?: Document | null,
): string | null {
  if (doc == null) return null;

  const canvas = doc.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let imageData: ImageData | { data: Uint8ClampedArray } | null = null;
  if (typeof ctx.createImageData === "function") {
    const created = ctx.createImageData(raster.width, raster.height);
    if (created != null && "data" in created && created.data != null) {
      imageData = created;
    }
  }

  if (imageData == null && typeof ImageData !== "undefined") {
    imageData = new ImageData(
      new Uint8ClampedArray(raster.pixels),
      raster.width,
      raster.height,
    );
  }

  if (imageData == null) {
    imageData = { data: new Uint8ClampedArray(raster.width * raster.height * 4) };
  }

  imageData.data.set(raster.pixels);
  ctx.putImageData(imageData as ImageData, 0, 0);
  return typeof canvas.toDataURL === "function" ? canvas.toDataURL("image/png") : null;
}

export function rasterToPngDataURL(raster: KDERasterData): string {
  return `data:image/png;base64,${encodeBase64(rasterToPngBytes(raster))}`;
}

export function densityToDataURL(
  model: KDEModel,
  colorStops: readonly ColorStop[],
  opacity = 1,
  doc: Document | null | undefined = typeof document === "undefined"
    ? undefined
    : document,
): string | null {
  const raster = buildKDERasterData(model, colorStops, opacity);
  if (raster == null) return null;
  return rasterToCanvasDataURL(raster, doc) ?? rasterToPngDataURL(raster);
}
