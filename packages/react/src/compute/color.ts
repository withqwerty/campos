export type ColorStop = { offset: number; color: string };

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Linearly interpolate between color stops defined as `{ offset, color }`.
 * Input `t` is clamped to [0, 1].
 */
export function interpolateStops(
  stops: ReadonlyArray<{ offset: number; color: string }>,
  t: number,
): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const cur = stops[i];
    const nxt = stops[i + 1];
    if (!cur || !nxt) continue;
    if (clamped >= cur.offset && clamped <= nxt.offset) {
      const ratio = (clamped - cur.offset) / (nxt.offset - cur.offset);
      const c = hexToRgb(cur.color);
      const n = hexToRgb(nxt.color);
      return rgbToHex([
        c[0] + (n[0] - c[0]) * ratio,
        c[1] + (n[1] - c[1]) * ratio,
        c[2] + (n[2] - c[2]) * ratio,
      ]);
    }
  }
  const last = stops[stops.length - 1];
  return last ? last.color : "#000000";
}
