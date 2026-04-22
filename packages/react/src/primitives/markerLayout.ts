import type { ReactNode } from "react";

/**
 * Pure layout engine for the 8-slot player-marker composition system.
 *
 * This module contains zero React — it is a table-driven pure function that
 * takes a description of a marker (radius, pitch bounds, projected centre,
 * slot contents with precomputed cell sizes) and returns the final local
 * translation for every slot item plus a group-level shift vector that
 * keeps all decorations inside the pitch.
 *
 * The split between layout math and React rendering is deliberate:
 *
 *   1. **Testable without a DOM.** We assert placements as plain numbers in
 *      fast Vitest tables; no JSDOM, no jsdom-axe, no measuring via bbox.
 *   2. **Formation and other lineup charts share one anchor model.** Future
 *      PassNetwork or live-match views can call the same function without
 *      also pulling in `<FormationMarker>`'s glyph resolution.
 *   3. **Per-primitive cell sizes are data, not layout.** Each primitive
 *      (MarkerIcon, MarkerPill, RatingPill, custom) declares its own
 *      "nominal cell" in `r` units; the layout engine doesn't know the
 *      visual shape, only its rectangular footprint.
 *
 * The 8 slots form a compass around the marker centre:
 *
 * ```
 *    topLeft    top    topRight
 *         \     |     /
 *          \    |    /
 *   left -- [ glyph ] -- right
 *          /    |    \
 *         /     |     \
 *  bottomLeft  bottom  bottomRight
 *               |
 *          [ bottom slot content stacks directly below the glyph ]
 *               |
 *          [ name pill, pushed down by the bottom stack height ]
 * ```
 *
 * Stacking rules differ per slot and are captured in the `SlotGeometry`
 * table below. See the `computeMarkerSlotLayout` body for the exact
 * per-slot positioning formulas.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MarkerSlotName =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

/**
 * Stable ordering of the 8 slot names. Exported so callers iterating over
 * all slots get a consistent, predictable sequence (useful for debugging
 * and deterministic test output).
 */
export const MARKER_SLOT_NAMES: readonly MarkerSlotName[] = [
  "top",
  "topRight",
  "right",
  "bottomRight",
  "bottom",
  "bottomLeft",
  "left",
  "topLeft",
] as const;

/**
 * One item in a slot. The `node` is opaque to the layout engine — it is
 * whatever React node the caller wants to render at the computed position.
 * The engine only reads `cellWidth` and `cellHeight` to compute placements.
 */
export type SlotItemSpec = {
  /** React node to render at the computed position. */
  node: ReactNode;
  /** Nominal cell width in SVG user units. */
  cellWidth: number;
  /** Nominal cell height in SVG user units. */
  cellHeight: number;
};

/**
 * A slot's contents after normalisation: always an array (empty, single
 * item, or multiple items for stacking).
 */
export type SlotContent = SlotItemSpec[];

/**
 * One placed item with its final local translation relative to the marker
 * centre (before any group-level clamp shift).
 */
export type SlotItemPlacement = {
  /** The original node passed in. */
  node: ReactNode;
  /** Local X translation from the marker centre. */
  translateX: number;
  /** Local Y translation from the marker centre. */
  translateY: number;
  /** Cell width, echoed so consumers can wrap the node if needed. */
  cellWidth: number;
  /** Cell height, echoed so consumers can wrap the node if needed. */
  cellHeight: number;
};

export type SlotPlacement = {
  slot: MarkerSlotName;
  items: SlotItemPlacement[];
};

export type LayoutInput = {
  /** Marker circle radius in SVG user units. Drives every derived size. */
  r: number;
  /** Font size of the name pill's text. Used to position the name below the bottom stack. */
  nameFontSize: number;
  /** Whether a name pill will be rendered (affects nameBottomY output, not slot math). */
  showName: boolean;
  /**
   * Actual rendered width of the name pill in SVG user units. The clamp
   * bbox uses this for the pill's horizontal extent — passing the real
   * width (rather than letting the engine guess) is what stops long
   * names from clipping past the pitch edge for wide players.
   *
   * Optional: if omitted, the engine falls back to `nameFontSize * 7.2`,
   * which matches the worst-case 12-character truncated label width.
   */
  namePillWidth?: number;
  /** Marker centre x in svg-absolute user units. Used for pitch-edge clamping. */
  markerCentreX: number;
  /** Marker centre y in svg-absolute user units. */
  markerCentreY: number;
  /** Pitch svg x-axis extent. Vertical pitch → PITCH.width; horizontal → PITCH.length. */
  pitchSvgWidth: number;
  /** Pitch svg y-axis extent (height of visible area). Vertical pitch → PITCH.length; horizontal → PITCH.width. */
  pitchSvgHeight: number;
  /** Minimum visible X coordinate (viewBox minX). Defaults to 0. */
  pitchSvgMinX?: number;
  /** Minimum visible Y coordinate (viewBox minY). Defaults to 0. */
  pitchSvgMinY?: number;
  /** Safety padding kept between slot content and pitch edges. Default `r * 0.25`. */
  clampMargin?: number;
  /** Per-slot content. Any omitted slot is treated as empty. */
  slots: Partial<Record<MarkerSlotName, SlotContent>>;
};

export type LayoutOutput = {
  /** Per-slot placements with final local translations. */
  placements: SlotPlacement[];
  /**
   * X offset applied to the whole decorations group so it stays inside the
   * pitch. Callers wrap the slot group in `<g transform="translate(...)">`
   * with this shift. The marker glyph is NOT wrapped, so the circle stays
   * on its projected pitch position.
   */
  groupShiftX: number;
  /** Y offset applied to the whole decorations group. */
  groupShiftY: number;
  /**
   * Local Y coordinate where the name pill's centre should render. The
   * name is NOT a slot but its position depends on whether the `bottom`
   * slot has content — this value tells the caller exactly where to
   * position the pill so the bottom stack sits between the glyph and
   * the name.
   */
  nameCentreY: number;
  /**
   * Local Y coordinate where the name pill's rendered bottom edge sits.
   * Used by the clamp bbox calculation so the name is considered part of
   * the decorations group.
   */
  nameBottomY: number;
};

// ---------------------------------------------------------------------------
// Slot geometry table
// ---------------------------------------------------------------------------

/**
 * Static description of one slot's stacking behaviour. The numeric anchor
 * is computed dynamically from the marker radius AND the actual cell
 * sizes of the slot's content (see `computeSlotAnchor` below) — that's
 * what stops bigger primitives from stacking *into* the marker circle.
 */
type SlotGeometry = {
  /** Direction items grow when stacked. */
  stackAxis: "horizontal" | "vertical";
  /**
   * How items are positioned along the stack axis:
   * - `"centred"` — items are centred on the anchor. Odd count: middle
   *   item is exactly on the anchor. Even count: items straddle the anchor
   *   symmetrically. Used by top/bottom/left/right compass slots.
   * - `"pinned-positive"` — anchor is the leading edge of the first item,
   *   stack grows in the positive direction (rightward for horizontal,
   *   downward for vertical).
   * - `"pinned-negative"` — anchor is the trailing edge of the first item,
   *   stack grows in the negative direction (leftward for horizontal,
   *   upward for vertical).
   */
  stackOrigin: "centred" | "pinned-positive" | "pinned-negative";
};

/**
 * Gap between the marker edge and the nearest slot content, as a multiple
 * of `r`. The same gap is applied between stacked items within a slot.
 */
export const SLOT_EDGE_GAP = 0.15;
export const SLOT_STACK_GAP = -0.04;

/**
 * Corner slots anchor at 45° (sin/cos = sqrt(2)/2 ≈ 0.707). The constant
 * trades numeric precision for readability.
 */
const CORNER_COS = 0.707;

const SLOT_GEOMETRY: Record<MarkerSlotName, SlotGeometry> = {
  top: { stackAxis: "horizontal", stackOrigin: "centred" },
  bottom: { stackAxis: "vertical", stackOrigin: "pinned-positive" },
  left: { stackAxis: "vertical", stackOrigin: "centred" },
  right: { stackAxis: "vertical", stackOrigin: "centred" },
  topLeft: { stackAxis: "horizontal", stackOrigin: "pinned-positive" },
  topRight: { stackAxis: "horizontal", stackOrigin: "pinned-negative" },
  bottomLeft: { stackAxis: "horizontal", stackOrigin: "pinned-negative" },
  bottomRight: { stackAxis: "horizontal", stackOrigin: "pinned-positive" },
};

/**
 * Compute a slot's anchor point given the marker radius and (for corner
 * slots) the first cell's width.
 *
 * **Tight positioning by design.** The compass slots use a constant
 * `r + gap` offset so items sit just outside the marker disc with their
 * inner edge slightly overlapping the marker — exactly the broadcast
 * lineup-card look the user asked for. Corner slots place the first
 * item's centre on the marker's 45° projection (`r * cos45°`) so the
 * item visually anchors to the corner regardless of its size; tall
 * items naturally overlap the marker by `cellHeight/2 - gap` units.
 *
 * The user is responsible for keeping per-pill content concise enough
 * that the natural overlap looks right. Earlier the layout engine
 * pushed items fully clear of the marker (back-off by `maxCell/2`),
 * which looked too loose for the broadcast preset — see the review
 * iteration after the F2 push-out experiment.
 *
 * Corner X anchors use `firstCellWidth/2` so the first item lands at
 * the 45° point regardless of size — otherwise varying cell widths
 * would scoot the first item around the corner.
 */
function computeSlotAnchor(
  slot: MarkerSlotName,
  r: number,
  dims: { firstCellWidth: number },
): { x: number; y: number } {
  const gap = SLOT_EDGE_GAP * r;
  const cornerX = r * CORNER_COS;
  const cornerY = r * CORNER_COS;

  switch (slot) {
    case "top":
      return { x: 0, y: -r - gap };
    case "bottom":
      // pinned-positive vertical: anchor is the TOP edge of the first item.
      // No gap — bottom content sits flush against the marker circle.
      return { x: 0, y: r };
    case "left":
      return { x: -r - gap, y: 0 };
    case "right":
      return { x: r + gap, y: 0 };
    case "topLeft":
      // pinned-positive horizontal: anchor.x is the LEFT edge of the first
      // item; we want the first item centred on (-cornerX) so anchor.x is
      // pulled left by firstCellWidth/2.
      return {
        x: -cornerX - dims.firstCellWidth / 2,
        y: -cornerY - gap,
      };
    case "topRight":
      // pinned-negative horizontal: anchor.x is the RIGHT edge of the
      // first item (the rightmost point of the stack); we want the first
      // item centred on +cornerX so anchor.x = cornerX + firstCellWidth/2.
      return {
        x: cornerX + dims.firstCellWidth / 2,
        y: -cornerY - gap,
      };
    case "bottomLeft":
      // pinned-negative: grows leftward (outward from marker). Anchor.x
      // is the RIGHT edge of the first item so content[0] centres on
      // -cornerX and subsequent items extend leftward.
      return {
        x: -cornerX + dims.firstCellWidth / 2,
        y: cornerY + gap,
      };
    case "bottomRight":
      // pinned-positive: grows rightward (outward from marker). Anchor.x
      // is the LEFT edge of the first item so content[0] centres on
      // +cornerX and subsequent items extend rightward.
      return {
        x: cornerX - dims.firstCellWidth / 2,
        y: cornerY + gap,
      };
  }
}

// ---------------------------------------------------------------------------
// Core layout function
// ---------------------------------------------------------------------------

/**
 * Compute final per-item placements for all slots, plus the group-level
 * clamp shift and the name pill's Y position.
 *
 * The function is pure and deterministic — same input, same output. No
 * React, no DOM, no side effects. See the public type definitions above
 * for the input/output shape.
 *
 * Algorithm:
 *
 * 1. For each non-empty slot, compute anchor + per-item positions using
 *    the slot's geometry table entry. Items are laid out along the stack
 *    axis with `SLOT_STACK_GAP * r` between them.
 * 2. Track the y range consumed by the `bottom` slot so the name pill can
 *    be pushed below it.
 * 3. Union every placed item's bbox (plus the marker circle, plus the
 *    name pill if rendered) and compare against the pitch edges shifted
 *    by `clampMargin`. Compute a single (dx, dy) that brings the union
 *    bbox inside bounds.
 * 4. Return placements with local translations + the group shift + the
 *    name centre/bottom coordinates.
 */
export function computeMarkerSlotLayout(input: LayoutInput): LayoutOutput {
  const {
    r,
    nameFontSize,
    showName,
    namePillWidth,
    markerCentreX,
    markerCentreY,
    pitchSvgWidth,
    pitchSvgHeight,
    pitchSvgMinX = 0,
    pitchSvgMinY = 0,
    slots,
  } = input;

  // Degenerate input guard. `r <= 0` happens during animations and
  // produces a meaningless layout — short-circuit so callers get a
  // sensible empty result instead of NaN-laced placements.
  if (r <= 0) {
    return {
      placements: [],
      groupShiftX: 0,
      groupShiftY: 0,
      nameCentreY: 0,
      nameBottomY: 0,
    };
  }

  const clampMargin = input.clampMargin ?? r * 0.25;
  const stackGap = SLOT_STACK_GAP * r;

  const placements: SlotPlacement[] = [];

  // Track the deepest decoration that protrudes below the glyph so the
  // name pill clears not only the `bottom` slot but also bottom-left /
  // bottom-right content that hangs lower than the marker edge.
  let lowestDecorationY = r; // start at the glyph's bottom edge

  for (const slotName of MARKER_SLOT_NAMES) {
    const content = slots[slotName];
    if (!content || content.length === 0) continue;

    const geometry = SLOT_GEOMETRY[slotName];

    // The first item's cell width feeds the corner anchor formula so
    // `content[0]` lands centred on the 45° projection of the marker
    // regardless of how wide it is. Compass slots ignore this and use
    // a constant offset.
    const firstItem = content[0] as SlotItemSpec; // length-checked above
    const { x: anchorX, y: anchorY } = computeSlotAnchor(slotName, r, {
      firstCellWidth: firstItem.cellWidth,
    });

    const items: SlotItemPlacement[] = [];

    if (geometry.stackAxis === "horizontal") {
      const totalWidth =
        content.reduce((acc, item) => acc + item.cellWidth, 0) +
        stackGap * Math.max(0, content.length - 1);

      if (geometry.stackOrigin === "pinned-negative") {
        // Iterate forward but place items right-to-left so content[0]
        // lands at the rightmost (corner) position. The cursor tracks
        // the right edge of the next item to place.
        let cursorRightX = anchorX;
        for (const item of content) {
          const itemCentreX = cursorRightX - item.cellWidth / 2;
          items.push({
            node: item.node,
            translateX: itemCentreX,
            translateY: anchorY,
            cellWidth: item.cellWidth,
            cellHeight: item.cellHeight,
          });
          cursorRightX -= item.cellWidth + stackGap;
        }
      } else {
        // centred or pinned-positive — cursor is the left edge of the
        // next item to place.
        let cursorLeftX: number;
        if (geometry.stackOrigin === "centred") {
          cursorLeftX = anchorX - totalWidth / 2;
        } else {
          // pinned-positive
          cursorLeftX = anchorX;
        }
        for (const item of content) {
          const itemCentreX = cursorLeftX + item.cellWidth / 2;
          items.push({
            node: item.node,
            translateX: itemCentreX,
            translateY: anchorY,
            cellWidth: item.cellWidth,
            cellHeight: item.cellHeight,
          });
          cursorLeftX += item.cellWidth + stackGap;
        }
      }
    } else {
      // vertical stack axis
      const totalHeight =
        content.reduce((acc, item) => acc + item.cellHeight, 0) +
        stackGap * Math.max(0, content.length - 1);

      if (geometry.stackOrigin === "pinned-negative") {
        let cursorBottomY = anchorY;
        for (const item of content) {
          const itemCentreY = cursorBottomY - item.cellHeight / 2;
          items.push({
            node: item.node,
            translateX: anchorX,
            translateY: itemCentreY,
            cellWidth: item.cellWidth,
            cellHeight: item.cellHeight,
          });
          cursorBottomY -= item.cellHeight + stackGap;
        }
      } else {
        let cursorTopY: number;
        if (geometry.stackOrigin === "centred") {
          cursorTopY = anchorY - totalHeight / 2;
        } else {
          // pinned-positive (e.g. bottom slot grows downward)
          cursorTopY = anchorY;
        }
        for (const item of content) {
          const itemCentreY = cursorTopY + item.cellHeight / 2;
          items.push({
            node: item.node,
            translateX: anchorX,
            translateY: itemCentreY,
            cellWidth: item.cellWidth,
            cellHeight: item.cellHeight,
          });
          cursorTopY += item.cellHeight + stackGap;
        }
      }
    }

    for (const item of items) {
      const itemBottom = item.translateY + item.cellHeight / 2;
      if (itemBottom > lowestDecorationY) lowestDecorationY = itemBottom;
    }

    placements.push({ slot: slotName, items });
  }

  // Name pill positioning. The pill sits below whichever decoration
  // reaches farthest into the lower half of the marker system. This
  // covers the dedicated `bottom` stack as well as bottom-left /
  // bottom-right badges that can otherwise crowd the name.
  const namePillHeight = nameFontSize * 1.5;
  const nameGap = r * 0.11; // baseline clearance below the glyph/name stack
  const nameCentreY = showName
    ? lowestDecorationY + nameGap + namePillHeight / 2
    : lowestDecorationY;
  const nameBottomY = showName ? nameCentreY + namePillHeight / 2 : lowestDecorationY;

  // ---------------------------------------------------------------------
  // Pitch-edge clamping
  // ---------------------------------------------------------------------
  //
  // Union the bboxes of every placed item + the marker circle + the name
  // pill. Convert to svg-absolute coordinates by adding the marker centre.
  // Then compute the minimum shift that brings the union inside
  // `[clampMargin, pitchSvgWidth - clampMargin] × [clampMargin, pitchSvgHeight - clampMargin]`.

  let unionMinX = -r;
  let unionMaxX = r;
  let unionMinY = -r;
  let unionMaxY = r;

  for (const placement of placements) {
    for (const item of placement.items) {
      const left = item.translateX - item.cellWidth / 2;
      const right = item.translateX + item.cellWidth / 2;
      const top = item.translateY - item.cellHeight / 2;
      const bottom = item.translateY + item.cellHeight / 2;
      if (left < unionMinX) unionMinX = left;
      if (right > unionMaxX) unionMaxX = right;
      if (top < unionMinY) unionMinY = top;
      if (bottom > unionMaxY) unionMaxY = bottom;
    }
  }

  if (showName) {
    // Name pill width: prefer the actual rendered width when callers
    // pass it, otherwise fall back to the worst-case 12-char truncated
    // label width (`12 * nameFs * 0.6 = nameFs * 7.2`). Pill width is
    // driven by font size, not marker radius.
    const resolvedNamePillWidth = namePillWidth ?? nameFontSize * 7.2;
    const namePillHalfWidth = resolvedNamePillWidth / 2;
    if (-namePillHalfWidth < unionMinX) unionMinX = -namePillHalfWidth;
    if (namePillHalfWidth > unionMaxX) unionMaxX = namePillHalfWidth;
    if (nameBottomY > unionMaxY) unionMaxY = nameBottomY;
  }

  // Absolute bounds after adding the marker centre.
  const absMinX = markerCentreX + unionMinX;
  const absMaxX = markerCentreX + unionMaxX;
  const absMinY = markerCentreY + unionMinY;
  const absMaxY = markerCentreY + unionMaxY;

  // Two-sided clamp: if both edges overflow simultaneously the union
  // bbox is wider than the playable strip, centre the group in the
  // available space rather than letting one edge silently override the other.
  const groupShiftX = computeAxisClampShift(
    absMinX,
    absMaxX,
    pitchSvgMinX + clampMargin,
    pitchSvgMinX + pitchSvgWidth - clampMargin,
  );
  const groupShiftY = computeAxisClampShift(
    absMinY,
    absMaxY,
    pitchSvgMinY + clampMargin,
    pitchSvgMinY + pitchSvgHeight - clampMargin,
  );

  return {
    placements,
    groupShiftX,
    groupShiftY,
    nameCentreY,
    nameBottomY,
  };
}

/**
 * Compute the minimum 1-D translation that keeps `[absMin, absMax]`
 * inside `[low, high]`. When the range is wider than `[low, high]` we
 * centre it instead — picking either edge would silently overflow the
 * other side, which is exactly the bug F1 in the adversarial review
 * flagged.
 */
function computeAxisClampShift(
  absMin: number,
  absMax: number,
  low: number,
  high: number,
): number {
  const overflowLow = low - absMin; // > 0 if range pokes past `low`
  const overflowHigh = absMax - high; // > 0 if range pokes past `high`
  if (overflowLow <= 0 && overflowHigh <= 0) return 0;
  if (overflowLow > 0 && overflowHigh <= 0) return overflowLow;
  if (overflowHigh > 0 && overflowLow <= 0) return -overflowHigh;
  // Both edges overflow — bbox wider than playable area. Centre it.
  return (overflowLow - overflowHigh) / 2;
}

// ---------------------------------------------------------------------------
// Cell-size helpers
// ---------------------------------------------------------------------------

/**
 * Nominal cell sizes for the built-in `MarkerIcon` kinds. Each entry is a
 * function of the marker radius `r` so the size scales correctly under
 * SCALE_FULL / SCALE_HALF / SCALE_DUAL. Values are tuned to match the
 * visual footprint of each shape with a little breathing room.
 */
export const MARKER_ICON_CELL_SIZES = {
  "yellow-card": (r: number) => ({ cellWidth: r * 0.6, cellHeight: r * 0.88 }),
  "red-card": (r: number) => ({ cellWidth: r * 0.6, cellHeight: r * 0.88 }),
  sub: (r: number) => ({ cellWidth: r * 1.2, cellHeight: r * 1.2 }),
  goal: (r: number) => ({ cellWidth: r * 0.85, cellHeight: r * 0.85 }),
  "goal-outline": (r: number) => ({ cellWidth: r * 0.85, cellHeight: r * 0.85 }),
  assist: (r: number) => ({ cellWidth: r * 0.85, cellHeight: r * 0.85 }),
  "assist-outline": (r: number) => ({ cellWidth: r * 0.85, cellHeight: r * 0.85 }),
  captain: (r: number) => ({ cellWidth: r * 0.8, cellHeight: r * 0.8 }),
  flag: (r: number) => ({ cellWidth: r * 1.0, cellHeight: r * 1.0 }),
  star: (r: number) => ({ cellWidth: r * 0.8, cellHeight: r * 0.8 }),
  dot: (r: number) => ({ cellWidth: r * 0.44, cellHeight: r * 0.44 }),
} as const;

export type MarkerIconKind = keyof typeof MARKER_ICON_CELL_SIZES;

/**
 * Nominal cell size for `RatingPill`. Matches the existing pill width
 * formula (`r * 1.35`) and height (`r * 0.72`).
 */
export function ratingPillCellSize(r: number): {
  cellWidth: number;
  cellHeight: number;
} {
  return { cellWidth: r * 1.35, cellHeight: r * 0.72 };
}

/**
 * Nominal cell height for `MarkerPill`. Width is computed per-instance
 * from text length via the existing `estimateSmallPillWidth` helper in
 * `PlayerBadges.tsx`.
 */
export function markerPillCellHeight(r: number): number {
  return r * 0.72;
}

/**
 * Fallback cell size for user-supplied custom ReactNodes. Returns a
 * square of `r × r` — roughly the size of a marker disc — which is a
 * sensible default for unknown content.
 */
export function defaultCustomCellSize(r: number): {
  cellWidth: number;
  cellHeight: number;
} {
  return { cellWidth: r, cellHeight: r };
}
