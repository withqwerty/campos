import type { ProjectFn } from "@withqwerty/campos-stadia";

type Point = { x: number; y: number };

/**
 * Andrew's monotone chain convex hull algorithm.
 * Returns vertices in counter-clockwise order.
 * Expects at least 3 non-collinear points; returns input as-is for < 3 points.
 */
function computeConvexHull(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  function build(input: Point[]): Point[] {
    const hull: Point[] = [];
    for (const p of input) {
      while (hull.length >= 2) {
        const a = hull[hull.length - 2]!;
        const b = hull[hull.length - 1]!;
        if (cross(a, b, p) <= 0) hull.pop();
        else break;
      }
      hull.push(p);
    }
    hull.pop();
    return hull;
  }

  const lower = build(sorted);
  const upper = build([...sorted].reverse());

  return [...lower, ...upper];
}

export type ConvexHullLayerProps = {
  /** Points in Campos 0-100 pitch coordinates. */
  points: readonly Point[];
  /** Pitch projection function from the Pitch render prop. */
  project: ProjectFn;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

/**
 * Renders a convex hull polygon over a set of pitch-coordinate points.
 * Use inside a `<Pitch>` render prop to show the spatial footprint of
 * passes, shots, touches, or any event set.
 *
 * ```tsx
 * <Pitch crop="full" orientation="vertical">
 *   {({ project }) => (
 *     <ConvexHullLayer
 *       points={passes.map(p => ({ x: p.fromX, y: p.fromY }))}
 *       project={project}
 *       fill="rgba(0,0,0,0.04)"
 *       stroke="rgba(0,0,0,0.08)"
 *     />
 *   )}
 * </Pitch>
 * ```
 */
export function ConvexHullLayer({
  points,
  project,
  fill = "rgba(0,0,0,0.04)",
  stroke = "rgba(0,0,0,0.08)",
  strokeWidth = 0.3,
  opacity,
}: ConvexHullLayerProps) {
  if (points.length < 3) return null;

  const hull = computeConvexHull(points);
  const projected = hull.map((p) => project(p.x, p.y));
  const d = projected.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <polygon
      points={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      {...(opacity != null ? { opacity } : {})}
    />
  );
}
