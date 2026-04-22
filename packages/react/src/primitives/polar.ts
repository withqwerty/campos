/**
 * Shared polar geometry helpers for PizzaChart and RadarChart.
 */

export function roundSvg(value: number, precision = 4): number {
  return Number(value.toFixed(precision));
}

export function polarToXY(
  angle: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return {
    x: roundSvg(cx + radius * Math.cos(angle)),
    y: roundSvg(cy + radius * Math.sin(angle)),
  };
}

/** Full-circle SVG path (two semicircular arcs). */
export function ringPath(r: number, cx: number, cy: number): string {
  const left = roundSvg(cx - r);
  const right = roundSvg(cx + r);
  const centerY = roundSvg(cy);
  const radius = roundSvg(r);
  return [
    `M ${left} ${centerY}`,
    `A ${radius} ${radius} 0 1 1 ${right} ${centerY}`,
    `A ${radius} ${radius} 0 1 1 ${left} ${centerY}`,
    `Z`,
  ].join(" ");
}

/** Annular slice (wedge between inner and outer arcs). */
export function slicePath(
  startAngle: number,
  endAngle: number,
  innerR: number,
  outerR: number,
  cx: number,
  cy: number,
): string {
  const outerStart = polarToXY(startAngle, outerR, cx, cy);
  const outerEnd = polarToXY(endAngle, outerR, cx, cy);
  const innerStart = polarToXY(endAngle, innerR, cx, cy);
  const innerEnd = polarToXY(startAngle, innerR, cx, cy);

  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  const outerRadius = roundSvg(outerR);
  const innerRadius = roundSvg(innerR);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    `Z`,
  ].join(" ");
}

/**
 * Arc path for curved text labels. When `flip` is true, the arc reverses
 * direction so text in the bottom half of the circle reads correctly.
 */
export function labelArcPath(
  midAngle: number,
  halfAngle: number,
  radius: number,
  cx: number,
  cy: number,
  flip: boolean,
): string {
  const a1 = midAngle - halfAngle;
  const a2 = midAngle + halfAngle;
  const radiusValue = roundSvg(radius);

  if (flip) {
    const s = polarToXY(a2, radius, cx, cy);
    const e = polarToXY(a1, radius, cx, cy);
    const sweep = a2 - a1;
    const large = sweep > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radiusValue} ${radiusValue} 0 ${large} 0 ${e.x} ${e.y}`;
  }

  const s = polarToXY(a1, radius, cx, cy);
  const e = polarToXY(a2, radius, cx, cy);
  const sweep = a2 - a1;
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${radiusValue} ${radiusValue} 0 ${large} 1 ${e.x} ${e.y}`;
}

// Curved label constants
export const LABEL_FONT_SIZE = 8.5;
export const LABEL_CHAR_WIDTH = 5;
export const LABEL_LINE_HEIGHT = 10;
export const LABEL_ANGLE_PADDING = 0.04;

/** Open arc path (stroke-only, no fill) for reference value lines. */
export function arcSegmentPath(
  startAngle: number,
  endAngle: number,
  radius: number,
  cx: number,
  cy: number,
): string {
  const start = polarToXY(startAngle, radius, cx, cy);
  const end = polarToXY(endAngle, radius, cx, cy);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  const r = roundSvg(radius);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** Split label text into lines that fit within the available arc length. */
export function wrapLabel(text: string, arcLength: number): string[] {
  const maxChars = Math.max(4, Math.floor(arcLength / LABEL_CHAR_WIDTH));
  if (text.length <= maxChars) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
