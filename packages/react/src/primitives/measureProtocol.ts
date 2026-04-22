import type { ReactElement, ReactNode } from "react";

/**
 * Symbol-keyed measurement protocol for marker slot primitives.
 *
 * Background: the layout engine needs each slot item's cell size BEFORE
 * React renders it. The previous approach checked `element.type ===
 * MarkerIcon` by reference equality, which is fragile under:
 *
 * - HMR (separate module identities for the same source)
 * - `React.memo` wrappers (the wrapper isn't `MarkerIcon`)
 * - Re-exports through user-owned barrels (Vite's dep-optimizer can split)
 *
 * The protocol fix: each primitive attaches a measurement function via
 * a stable Symbol key on its function object. Cell measurement looks up
 * that symbol — no reference equality, no module-identity dependency.
 *
 * Wrappers (React.memo, React.forwardRef) are unwrapped automatically
 * by walking the inner `type` field, so users can compose freely.
 */

export const CAMPOS_CELL_SIZE = Symbol.for("campos.measureCellSize");

/**
 * The shape of a primitive's measurement function. Receives the React
 * element's props and the parent marker radius `r`, and returns the
 * primitive's nominal cell size in SVG user units.
 */
export type CellSizeFn = (
  props: Record<string, unknown>,
  r: number,
) => { cellWidth: number; cellHeight: number };

/**
 * Tag a primitive component with its cell-size function. Call once at
 * module load time, after the component is defined:
 *
 * ```ts
 * export function MarkerIcon(props) { ... }
 * registerCellSize(MarkerIcon, (props, r) => MARKER_ICON_CELL_SIZES[props.kind](r));
 * ```
 *
 * The tag survives `React.memo` and `React.forwardRef` wraps because
 * `lookupCellSize` walks the inner `type` chain.
 */
export function registerCellSize(component: object, fn: CellSizeFn): void {
  // Symbol-keyed property — invisible to users iterating component
  // properties for displayName, defaultProps, etc.
  (component as unknown as Record<symbol, CellSizeFn>)[CAMPOS_CELL_SIZE] = fn;
}

/**
 * Look up the cell-size function attached to a React element's
 * component type. Returns `undefined` if the element is not a
 * registered primitive (or if it's a fragment, raw text, or arbitrary
 * user code that hasn't opted into the protocol).
 *
 * Walks `React.memo` and `React.forwardRef` wrappers by following the
 * inner `type` field — so wrapping a primitive with `React.memo` does
 * not silently break measurement.
 */
export function lookupCellSize(node: ReactNode): CellSizeFn | undefined {
  if (typeof node !== "object" || node == null || !("type" in node)) {
    return undefined;
  }
  // Walk through any wrapper layers (React.memo, forwardRef) to find
  // the underlying function component the primitive was registered on.
  // Both wrappers expose their inner component as a `type` field on the
  // wrapper object.
  let t: unknown = (node as ReactElement).type;
  for (let depth = 0; depth < 5; depth += 1) {
    if (t == null) return undefined;
    if (typeof t === "function") {
      const tagged = (t as unknown as Record<symbol, CellSizeFn | undefined>)[
        CAMPOS_CELL_SIZE
      ];
      if (typeof tagged === "function") return tagged;
      return undefined;
    }
    if (typeof t === "object" && "type" in t) {
      t = (t as { type: unknown }).type;
      continue;
    }
    return undefined;
  }
  return undefined;
}
