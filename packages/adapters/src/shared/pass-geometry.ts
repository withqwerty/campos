import type { PassEvent } from "@withqwerty/campos-schema";

export function computePassLengthAndAngle(
  x: number | null | undefined,
  y: number | null | undefined,
  endX: number | null | undefined,
  endY: number | null | undefined,
): Pick<PassEvent, "length" | "angle"> {
  if (x == null || y == null || endX == null || endY == null) {
    return { length: null, angle: null };
  }

  const dx = endX - x;
  const dy = endY - y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  return {
    length: Math.round(length * 100) / 100,
    angle: Math.round(angle * 10000) / 10000,
  };
}
