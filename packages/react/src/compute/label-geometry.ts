export type LabelRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type LabelCircle = {
  cx: number;
  cy: number;
  r: number;
};

export function approxLabelWidth(text: string): number {
  return Math.max(22, Math.min(120, text.length * 5.8 + 8));
}

export function rectsOverlap(a: LabelRect, b: LabelRect): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function circleIntersectsRect(circle: LabelCircle, rect: LabelRect): boolean {
  const closestX = Math.max(rect.left, Math.min(circle.cx, rect.right));
  const closestY = Math.max(rect.top, Math.min(circle.cy, rect.bottom));
  const dx = circle.cx - closestX;
  const dy = circle.cy - closestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}
