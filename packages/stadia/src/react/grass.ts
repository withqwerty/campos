import type { ReactNode } from "react";
import { createElement } from "react";
import { PITCH } from "../geometry/constants.js";
import type { PitchOrientation } from "../geometry/pitch.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shared configuration for all built-in grass patterns. */
type GrassPatternBase = {
  /** Width of each band/tile in meters. Default: 5 */
  bandWidth?: number;
  /** Colour of the "light" mowing band. Default: derived from pitch fill (+8% brightness) */
  lightFill?: string;
  /** Colour of the "dark" mowing band. Default: derived from pitch fill (-8% brightness) */
  darkFill?: string;
  /** Opacity of the pattern overlay (0–1). Default: 1 */
  opacity?: number;
};

/** Alternating horizontal bands parallel to the goal line. */
type StripesPattern = GrassPatternBase & { type: "stripes" };

/** Diagonal bands at a configurable angle. */
type DiagonalPattern = GrassPatternBase & {
  type: "diagonal";
  /** Angle in degrees from the goal line. Default: 45 */
  angle?: number;
};

/** V-shaped chevrons pointing toward a goal (like Arsenal's pitch). */
type ChevronPattern = GrassPatternBase & {
  type: "chevron";
  /** Angle of each arm from the centre line, in degrees. Default: 45 */
  angle?: number;
};

/** Concentric rings radiating from the centre spot. */
type ConcentricPattern = GrassPatternBase & {
  type: "concentric";
  /** Ring width in meters. Overrides bandWidth when set. Default: bandWidth or 5 */
  ringWidth?: number;
};

/** Alternating light/dark squares. */
type CheckerboardPattern = GrassPatternBase & { type: "checkerboard" };

/** User-provided SVG pattern element for full control. */
type CustomPattern = {
  type: "custom";
  /** Unique ID for the pattern element. */
  id: string;
  /** Returns props for an SVG <pattern> element including its children. */
  render: (ctx: {
    pitchLength: number;
    pitchWidth: number;
    orientation: PitchOrientation;
  }) => {
    children: ReactNode;
    [key: string]: unknown;
  };
};

/** Mathematical function mapping pitch coordinates to a colour index. */
type FormulaPattern = GrassPatternBase & {
  type: "formula";
  /**
   * Pure function mapping (x, y) in SVG coordinate space to a colour index.
   * Return 0 for lightFill, 1 for darkFill (clamped to 0|1).
   */
  fn: (x: number, y: number) => number;
  /** Grid cell size in meters. Default: 2 */
  resolution?: number;
};

export type GrassPattern =
  | StripesPattern
  | DiagonalPattern
  | ChevronPattern
  | ConcentricPattern
  | CheckerboardPattern
  | CustomPattern
  | FormulaPattern;

// ---------------------------------------------------------------------------
// Colour utilities
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  // Handle 3-char shorthand
  const full =
    h.length === 3
      ? (h[0] ?? "0") +
        (h[0] ?? "0") +
        (h[1] ?? "0") +
        (h[1] ?? "0") +
        (h[2] ?? "0") +
        (h[2] ?? "0")
      : h.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Adjust a hex colour's brightness by a percentage (-100 to +100). */
export function adjustHexBrightness(hex: string, percent: number): string {
  const [r, g, b] = parseHex(hex);
  const factor = percent / 100;
  if (factor >= 0) {
    // Lighten: move toward 255
    return toHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
  }
  // Darken: move toward 0
  const f = 1 + factor;
  return toHex(r * f, g * f, b * f);
}

/** Resolve the light/dark fill colours for a grass pattern. */
export function resolveGrassColors(
  baseFill: string,
  pattern: GrassPattern,
): { lightFill: string; darkFill: string } {
  if (pattern.type === "custom") {
    return { lightFill: baseFill, darkFill: baseFill };
  }
  return {
    lightFill: pattern.lightFill ?? adjustHexBrightness(baseFill, 8),
    darkFill: pattern.darkFill ?? adjustHexBrightness(baseFill, -8),
  };
}

// ---------------------------------------------------------------------------
// Pattern renderers
// ---------------------------------------------------------------------------

type PatternContext = {
  orientation: PitchOrientation;
  pitchX: number;
  pitchY: number;
  pitchW: number;
  pitchH: number;
  lightFill: string;
  darkFill: string;
};

const PATTERN_ID_PREFIX = "stadia-grass";

function idFor(type: string): string {
  return `${PATTERN_ID_PREFIX}-${type}`;
}

function renderStripes(ctx: PatternContext, bandWidth: number): ReactNode {
  const isV = ctx.orientation === "vertical";
  const id = idFor("stripes");
  // Stripes run parallel to the goal line = perpendicular to the length axis.
  // Pattern tiles along the length axis.
  const tileW = isV ? ctx.pitchW : bandWidth * 2;
  const tileH = isV ? bandWidth * 2 : ctx.pitchH;

  return createElement(
    "g",
    { "data-stadia": "grass-pattern" },
    createElement(
      "defs",
      null,
      createElement(
        "pattern",
        {
          id,
          patternUnits: "userSpaceOnUse",
          x: ctx.pitchX,
          y: ctx.pitchY,
          width: tileW,
          height: tileH,
        },
        // Light band
        createElement("rect", {
          x: 0,
          y: 0,
          width: isV ? tileW : bandWidth,
          height: isV ? bandWidth : tileH,
          fill: ctx.lightFill,
        }),
        // Dark band
        createElement("rect", {
          x: isV ? 0 : bandWidth,
          y: isV ? bandWidth : 0,
          width: isV ? tileW : bandWidth,
          height: isV ? bandWidth : tileH,
          fill: ctx.darkFill,
        }),
      ),
    ),
    createElement("rect", {
      x: ctx.pitchX,
      y: ctx.pitchY,
      width: ctx.pitchW,
      height: ctx.pitchH,
      fill: `url(#${id})`,
    }),
  );
}

function renderDiagonal(
  ctx: PatternContext,
  bandWidth: number,
  angle: number,
): ReactNode {
  const id = idFor("diagonal");
  // Use a square tile large enough for seamless tiling after rotation.
  const tileSize = bandWidth * 2;

  return createElement(
    "g",
    { "data-stadia": "grass-pattern" },
    createElement(
      "defs",
      null,
      createElement(
        "pattern",
        {
          id,
          patternUnits: "userSpaceOnUse",
          x: ctx.pitchX,
          y: ctx.pitchY,
          width: tileSize,
          height: tileSize,
          patternTransform: `rotate(${angle})`,
        },
        createElement("rect", {
          x: 0,
          y: 0,
          width: tileSize,
          height: bandWidth,
          fill: ctx.lightFill,
        }),
        createElement("rect", {
          x: 0,
          y: bandWidth,
          width: tileSize,
          height: bandWidth,
          fill: ctx.darkFill,
        }),
      ),
    ),
    createElement("rect", {
      x: ctx.pitchX,
      y: ctx.pitchY,
      width: ctx.pitchW,
      height: ctx.pitchH,
      fill: `url(#${id})`,
    }),
  );
}

function renderChevron(ctx: PatternContext, bandWidth: number, angle: number): ReactNode {
  const id = idFor("chevron");
  const isV = ctx.orientation === "vertical";

  // Chevron: V-shapes pointing along the length axis.
  // The tile is one full V cycle (two bands).
  const halfW = isV ? ctx.pitchW / 2 : ctx.pitchH / 2;
  const tileLen = bandWidth * 2;
  const rad = (angle * Math.PI) / 180;
  // How far the V arm extends along the length axis from centre to edge
  const armDepth = halfW * Math.tan(rad);

  // Tile dimensions
  const tw = isV ? ctx.pitchW : tileLen;
  const th = isV ? tileLen : ctx.pitchH;

  // Build V-shape path in tile-local coordinates.
  // For vertical: V points downward, apex at (halfW, 0), arms go to (0, armDepth) and (pitchW, armDepth)
  let lightPath: string;
  let darkPath: string;

  if (isV) {
    // Light band: V shape in top half of tile
    lightPath = [
      `M 0 0`,
      `L ${halfW} ${Math.min(armDepth, bandWidth)}`,
      `L ${ctx.pitchW} 0`,
      `L ${ctx.pitchW} ${bandWidth}`,
      `L ${halfW} ${Math.min(armDepth + bandWidth, tileLen)}`,
      `L 0 ${bandWidth}`,
      `Z`,
    ].join(" ");
    // Dark band: V shape in bottom half of tile
    darkPath = [
      `M 0 ${bandWidth}`,
      `L ${halfW} ${Math.min(armDepth + bandWidth, tileLen)}`,
      `L ${ctx.pitchW} ${bandWidth}`,
      `L ${ctx.pitchW} ${tileLen}`,
      `L ${halfW} ${Math.min(armDepth + tileLen, tileLen * 2)}`,
      `L 0 ${tileLen}`,
      `Z`,
    ].join(" ");
  } else {
    // Horizontal: V points rightward, apex at (0, halfH)
    lightPath = [
      `M 0 0`,
      `L ${Math.min(armDepth, bandWidth)} ${halfW}`,
      `L 0 ${ctx.pitchH}`,
      `L ${bandWidth} ${ctx.pitchH}`,
      `L ${Math.min(armDepth + bandWidth, tileLen)} ${halfW}`,
      `L ${bandWidth} 0`,
      `Z`,
    ].join(" ");
    darkPath = [
      `M ${bandWidth} 0`,
      `L ${Math.min(armDepth + bandWidth, tileLen)} ${halfW}`,
      `L ${bandWidth} ${ctx.pitchH}`,
      `L ${tileLen} ${ctx.pitchH}`,
      `L ${Math.min(armDepth + tileLen, tileLen * 2)} ${halfW}`,
      `L ${tileLen} 0`,
      `Z`,
    ].join(" ");
  }

  return createElement(
    "g",
    { "data-stadia": "grass-pattern" },
    createElement(
      "defs",
      null,
      createElement(
        "pattern",
        {
          id,
          patternUnits: "userSpaceOnUse",
          x: ctx.pitchX,
          y: ctx.pitchY,
          width: tw,
          height: th,
        },
        createElement("path", { d: lightPath, fill: ctx.lightFill }),
        createElement("path", { d: darkPath, fill: ctx.darkFill }),
      ),
    ),
    createElement("rect", {
      x: ctx.pitchX,
      y: ctx.pitchY,
      width: ctx.pitchW,
      height: ctx.pitchH,
      fill: `url(#${id})`,
    }),
  );
}

function renderCheckerboard(ctx: PatternContext, bandWidth: number): ReactNode {
  const id = idFor("checkerboard");
  const tileSize = bandWidth * 2;

  return createElement(
    "g",
    { "data-stadia": "grass-pattern" },
    createElement(
      "defs",
      null,
      createElement(
        "pattern",
        {
          id,
          patternUnits: "userSpaceOnUse",
          x: ctx.pitchX,
          y: ctx.pitchY,
          width: tileSize,
          height: tileSize,
        },
        createElement("rect", {
          x: 0,
          y: 0,
          width: bandWidth,
          height: bandWidth,
          fill: ctx.lightFill,
        }),
        createElement("rect", {
          x: bandWidth,
          y: 0,
          width: bandWidth,
          height: bandWidth,
          fill: ctx.darkFill,
        }),
        createElement("rect", {
          x: 0,
          y: bandWidth,
          width: bandWidth,
          height: bandWidth,
          fill: ctx.darkFill,
        }),
        createElement("rect", {
          x: bandWidth,
          y: bandWidth,
          width: bandWidth,
          height: bandWidth,
          fill: ctx.lightFill,
        }),
      ),
    ),
    createElement("rect", {
      x: ctx.pitchX,
      y: ctx.pitchY,
      width: ctx.pitchW,
      height: ctx.pitchH,
      fill: `url(#${id})`,
    }),
  );
}

function renderConcentric(ctx: PatternContext, ringWidth: number): ReactNode {
  const isV = ctx.orientation === "vertical";
  // Centre of the pitch in SVG coordinates
  const cx = ctx.pitchX + ctx.pitchW / 2;
  const cy = ctx.pitchY + ctx.pitchH / 2;

  // Max radius: corner-to-corner distance
  const halfL = (isV ? PITCH.length : PITCH.length) / 2;
  const halfW = (isV ? PITCH.width : PITCH.width) / 2;
  const maxR = Math.ceil(Math.sqrt(halfL * halfL + halfW * halfW));

  const circles: ReactNode[] = [];
  // Render from outermost to innermost so inner rings paint over outer
  for (let r = maxR; r > 0; r -= ringWidth) {
    const colorIndex = Math.floor(r / ringWidth) % 2;
    circles.push(
      createElement("circle", {
        key: `ring-${r}`,
        cx,
        cy,
        r,
        fill: colorIndex === 0 ? ctx.lightFill : ctx.darkFill,
      }),
    );
  }

  return createElement("g", { "data-stadia": "grass-pattern" }, ...circles);
}

function renderFormula(
  ctx: PatternContext,
  fn: (x: number, y: number) => number,
  resolution: number,
): ReactNode {
  const rects: ReactNode[] = [];
  const cols = Math.ceil(ctx.pitchW / resolution);
  const rows = Math.ceil(ctx.pitchH / resolution);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = ctx.pitchX + col * resolution;
      const y = ctx.pitchY + row * resolution;
      // Sample at cell centre
      const cx = x + resolution / 2;
      const cy = y + resolution / 2;
      const idx = fn(cx, cy) >= 0.5 ? 1 : 0;
      rects.push(
        createElement("rect", {
          key: `f-${row}-${col}`,
          x,
          y,
          width: Math.min(resolution, ctx.pitchX + ctx.pitchW - x),
          height: Math.min(resolution, ctx.pitchY + ctx.pitchH - y),
          fill: idx === 0 ? ctx.lightFill : ctx.darkFill,
        }),
      );
    }
  }

  return createElement("g", { "data-stadia": "grass-pattern" }, ...rects);
}

function renderCustom(ctx: PatternContext, pattern: CustomPattern): ReactNode {
  const { children, ...patternProps } = pattern.render({
    pitchLength: PITCH.length,
    pitchWidth: PITCH.width,
    orientation: ctx.orientation,
  });

  return createElement(
    "g",
    { "data-stadia": "grass-pattern" },
    createElement(
      "defs",
      null,
      createElement("pattern", { ...patternProps, id: pattern.id }, children),
    ),
    createElement("rect", {
      x: ctx.pitchX,
      y: ctx.pitchY,
      width: ctx.pitchW,
      height: ctx.pitchH,
      fill: `url(#${pattern.id})`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export type GrassPatternDefsProps = {
  pattern: GrassPattern;
  orientation: PitchOrientation;
  baseFill: string;
  pitchX: number;
  pitchY: number;
  pitchW: number;
  pitchH: number;
};

export function GrassPatternDefs({
  pattern,
  orientation,
  baseFill,
  pitchX,
  pitchY,
  pitchW,
  pitchH,
}: GrassPatternDefsProps): ReactNode {
  const { lightFill, darkFill } = resolveGrassColors(baseFill, pattern);
  const ctx: PatternContext = {
    orientation,
    pitchX,
    pitchY,
    pitchW,
    pitchH,
    lightFill,
    darkFill,
  };

  const opacity = pattern.type !== "custom" ? (pattern.opacity ?? 1) : 1;
  const bandWidth =
    pattern.type !== "custom" && pattern.type !== "formula"
      ? (pattern.bandWidth ?? 5)
      : 5;

  let content: ReactNode;

  switch (pattern.type) {
    case "stripes":
      content = renderStripes(ctx, bandWidth);
      break;
    case "diagonal":
      content = renderDiagonal(ctx, bandWidth, pattern.angle ?? 45);
      break;
    case "chevron":
      content = renderChevron(ctx, bandWidth, pattern.angle ?? 45);
      break;
    case "checkerboard":
      content = renderCheckerboard(ctx, bandWidth);
      break;
    case "concentric":
      content = renderConcentric(ctx, pattern.ringWidth ?? bandWidth);
      break;
    case "formula":
      content = renderFormula(ctx, pattern.fn, pattern.resolution ?? 2);
      break;
    case "custom":
      content = renderCustom(ctx, pattern);
      break;
  }

  if (opacity < 1) {
    return createElement("g", { opacity }, content);
  }
  return content;
}
