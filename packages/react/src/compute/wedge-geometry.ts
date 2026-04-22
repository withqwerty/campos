/**
 * SVG wedge geometry shared between `<PassSonar>` and `<PassSonarMarker>`.
 *
 * Canonical frame convention matches {@link computePassSonar}: angle 0 rad
 * points toward the opposition goal (canonical +x), positive angles rotate
 * CCW in the attacker-perspective frame. `polarToScreen` maps canonical
 * 0 → screen "up" (12 o'clock) by subtracting π/2.
 */

export function roundSvg(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert a Campos canonical-frame angle to screen coordinates centred on
 * `(cx, cy)` with `forward` (canonical 0 rad) at 12 o'clock and the
 * attacker's left (canonical +π/2 rad, since Campos `+y` grows toward
 * attacker's left) at 9 o'clock — the standard football-sonar convention
 * of "viewer standing behind the attacker, attacker attacking up". Radius
 * is in parent-SVG units.
 *
 * Mapping:
 *   canonical (1, 0)  → screen (0, -r)   top
 *   canonical (0, 1)  → screen (-r, 0)   left
 *   canonical (-1, 0) → screen (0,  r)   bottom
 *   canonical (0, -1) → screen (r,  0)   right
 *
 * The `- radius * cos(screenAngle)` (negated cos on x) encodes that
 * Campos `+y` maps to screen `-x`. Flipping that sign mirrors the entire
 * sonar about the vertical axis.
 */
export function polarToScreen(
  cx: number,
  cy: number,
  canonicalAngle: number,
  radius: number,
): { x: number; y: number } {
  const screenAngle = canonicalAngle - Math.PI / 2;
  return {
    x: cx - radius * Math.cos(screenAngle),
    y: cy + radius * Math.sin(screenAngle),
  };
}

/**
 * SVG path for an annular wedge sector spanning `[innerR, outerR]` between
 * canonical angles. `innerR = 0` produces a pure pie sector. Returns an
 * empty string when `outerR <= 0` or `outerR <= innerR`.
 */
export function wedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startCanonical: number,
  endCanonical: number,
): string {
  if (outerR <= 0 || outerR <= innerR) return "";
  const p0 = polarToScreen(cx, cy, startCanonical, outerR);
  const p1 = polarToScreen(cx, cy, endCanonical, outerR);
  const arcSweep = endCanonical - startCanonical > Math.PI ? 1 : 0;
  if (innerR <= 0) {
    return [
      `M ${roundSvg(cx)} ${roundSvg(cy)}`,
      `L ${roundSvg(p0.x)} ${roundSvg(p0.y)}`,
      `A ${roundSvg(outerR)} ${roundSvg(outerR)} 0 ${arcSweep} 1 ${roundSvg(p1.x)} ${roundSvg(p1.y)}`,
      "Z",
    ].join(" ");
  }
  const i0 = polarToScreen(cx, cy, endCanonical, innerR);
  const i1 = polarToScreen(cx, cy, startCanonical, innerR);
  return [
    `M ${roundSvg(p0.x)} ${roundSvg(p0.y)}`,
    `A ${roundSvg(outerR)} ${roundSvg(outerR)} 0 ${arcSweep} 1 ${roundSvg(p1.x)} ${roundSvg(p1.y)}`,
    `L ${roundSvg(i0.x)} ${roundSvg(i0.y)}`,
    `A ${roundSvg(innerR)} ${roundSvg(innerR)} 0 ${arcSweep} 0 ${roundSvg(i1.x)} ${roundSvg(i1.y)}`,
    "Z",
  ].join(" ");
}
