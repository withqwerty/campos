import { describe, expect, it } from "vitest";

import {
  MARKER_ICON_CELL_SIZES,
  MARKER_SLOT_NAMES,
  SLOT_EDGE_GAP,
  SLOT_STACK_GAP,
  computeMarkerSlotLayout,
  defaultCustomCellSize,
  markerPillCellHeight,
  ratingPillCellSize,
  type LayoutInput,
  type MarkerSlotName,
  type SlotContent,
} from "../src/primitives/markerLayout";

/**
 * Layout engine table tests. No React, no DOM — just assertions on the
 * pure function's output.
 *
 * Strategy: build a "centred" LayoutInput (marker at (0, 0), pitch large
 * enough that the clamp never fires) and swap out the `slots` payload for
 * each case. Placements are asserted as exact numbers so drift in the
 * anchor formulas would fail tests immediately.
 */

const R = 4; // use a round number so expected values stay clean
const BIG_PITCH_W = 100;
const BIG_PITCH_H = 100;

/** Make a dummy slot item with an explicit cell size. */
function item(
  cellWidth: number,
  cellHeight: number,
  tag = "node",
): {
  node: string;
  cellWidth: number;
  cellHeight: number;
} {
  return { node: tag, cellWidth, cellHeight };
}

/** Shared base input — marker centred in a very large pitch so clamp is never triggered. */
function baseInput(
  slots: Partial<Record<MarkerSlotName, SlotContent>>,
  overrides: Partial<LayoutInput> = {},
): LayoutInput {
  return {
    r: R,
    nameFontSize: 2,
    showName: false,
    markerCentreX: BIG_PITCH_W / 2,
    markerCentreY: BIG_PITCH_H / 2,
    pitchSvgWidth: BIG_PITCH_W,
    pitchSvgHeight: BIG_PITCH_H,
    slots,
    ...overrides,
  };
}

describe("computeMarkerSlotLayout — geometry", () => {
  it("returns no placements for empty input", () => {
    const out = computeMarkerSlotLayout(baseInput({}));
    expect(out.placements).toEqual([]);
    expect(out.groupShiftX).toBe(0);
    expect(out.groupShiftY).toBe(0);
  });

  it("places a single top item just above the marker (centre on the gap line)", () => {
    const cellH = R * 0.8;
    const out = computeMarkerSlotLayout(baseInput({ top: [item(R * 1, cellH, "a")] }));
    expect(out.placements).toHaveLength(1);
    const placed = out.placements[0]!;
    expect(placed.slot).toBe("top");
    expect(placed.items).toHaveLength(1);
    // Tight positioning: items are centred on the line `y = -r - gap`,
    // so they overlap the marker disc by `cellHeight/2 - gap` units —
    // exactly the broadcast lineup-card look.
    expect(placed.items[0]!.translateX).toBe(0);
    expect(placed.items[0]!.translateY).toBe(-R - SLOT_EDGE_GAP * R);
  });

  it("places a single bottom item just below the marker (not below the name)", () => {
    const out = computeMarkerSlotLayout(
      baseInput({ bottom: [item(R * 1, R * 0.8, "a")] }),
    );
    const placed = out.placements[0]!;
    expect(placed.slot).toBe("bottom");
    // Anchor y for bottom slot is r (no gap — content sits flush against the marker).
    // First item centre sits half a cell below the anchor.
    const expectedY = R + (R * 0.8) / 2;
    expect(placed.items[0]!.translateY).toBeCloseTo(expectedY, 6);
    expect(placed.items[0]!.translateX).toBe(0);
  });

  it("places left/right items just outside the marker on the horizontal axis", () => {
    const cellW = R * 0.8;
    const out = computeMarkerSlotLayout(
      baseInput({
        left: [item(cellW, R * 0.8, "l")],
        right: [item(cellW, R * 0.8, "r")],
      }),
    );
    const left = out.placements.find((p) => p.slot === "left")!;
    const right = out.placements.find((p) => p.slot === "right")!;
    // Tight: anchor.x = ±(r + gap), with the item centred on the
    // anchor. Items naturally overlap the marker by `cellWidth/2 - gap`.
    expect(left.items[0]!.translateX).toBe(-R - SLOT_EDGE_GAP * R);
    expect(left.items[0]!.translateY).toBe(0);
    expect(right.items[0]!.translateX).toBe(R + SLOT_EDGE_GAP * R);
    expect(right.items[0]!.translateY).toBe(0);
  });

  it("places corner items so the first item centres on the 45° projection", () => {
    const cellSize = R * 0.6;
    const out = computeMarkerSlotLayout(
      baseInput({
        topLeft: [item(cellSize, cellSize, "tl")],
        topRight: [item(cellSize, cellSize, "tr")],
        bottomLeft: [item(cellSize, cellSize, "bl")],
        bottomRight: [item(cellSize, cellSize, "br")],
      }),
    );
    // First item in any corner slot lands with its CENTRE on the
    // marker's 45° projection regardless of cell width — corner-X
    // anchor pulls back by firstCellWidth/2 to compensate for the
    // pinned positioning. Y line sits at `±r * cos45° ± gap`, so the
    // items naturally overlap the marker corner.
    const cornerX = R * 0.707;
    const cornerY = R * 0.707 + SLOT_EDGE_GAP * R;

    const tl = out.placements.find((p) => p.slot === "topLeft")!.items[0]!;
    const tr = out.placements.find((p) => p.slot === "topRight")!.items[0]!;
    const bl = out.placements.find((p) => p.slot === "bottomLeft")!.items[0]!;
    const br = out.placements.find((p) => p.slot === "bottomRight")!.items[0]!;

    expect(tl.translateX).toBeCloseTo(-cornerX, 6);
    expect(tl.translateY).toBeCloseTo(-cornerY, 6);
    expect(tr.translateX).toBeCloseTo(cornerX, 6);
    expect(tr.translateY).toBeCloseTo(-cornerY, 6);
    expect(bl.translateX).toBeCloseTo(-cornerX, 6);
    expect(bl.translateY).toBeCloseTo(cornerY, 6);
    expect(br.translateX).toBeCloseTo(cornerX, 6);
    expect(br.translateY).toBeCloseTo(cornerY, 6);
  });
});

describe("computeMarkerSlotLayout — stacking", () => {
  it("stacks top slot items horizontally, centred on the anchor", () => {
    // 3 items, each 1×1, with stack gap. Total width = 3 + 2*gap.
    const cellSize = 1;
    const out = computeMarkerSlotLayout(
      baseInput({
        top: [
          item(cellSize, cellSize, "a"),
          item(cellSize, cellSize, "b"),
          item(cellSize, cellSize, "c"),
        ],
      }),
    );
    const items = out.placements[0]!.items;
    expect(items).toHaveLength(3);
    // Symmetric: first item left of centre, second on centre, third right
    expect(items[1]!.translateX).toBeCloseTo(0, 6);
    // Gap between consecutive centres = cellSize + stackGap
    const centreGap = cellSize + SLOT_STACK_GAP * R;
    expect(items[0]!.translateX).toBeCloseTo(-centreGap, 6);
    expect(items[2]!.translateX).toBeCloseTo(centreGap, 6);
  });

  it("stacks bottomRight items rightward (outward) with content[0] at the corner", () => {
    const cellSize = 1;
    const out = computeMarkerSlotLayout(
      baseInput({
        bottomRight: [
          item(cellSize, cellSize, "first"),
          item(cellSize, cellSize, "second"),
          item(cellSize, cellSize, "third"),
        ],
      }),
    );
    const items = out.placements[0]!.items;
    expect(items).toHaveLength(3);
    // pinned-positive: content[0] at the corner, subsequent items
    // extend rightward (outward, away from the marker centre).
    const cornerX = R * 0.707;
    const centreGap = cellSize + SLOT_STACK_GAP * R;
    expect(items[0]!.translateX).toBeCloseTo(cornerX, 6);
    expect(items[1]!.translateX).toBeCloseTo(cornerX + centreGap, 6);
    expect(items[2]!.translateX).toBeCloseTo(cornerX + centreGap * 2, 6);
    expect(items[0]!.translateY).toBeCloseTo(items[1]!.translateY, 6);
    expect(items[1]!.translateY).toBeCloseTo(items[2]!.translateY, 6);
  });

  it("stacks bottomLeft items leftward (outward) with content[0] at the corner", () => {
    const cellSize = 1;
    const out = computeMarkerSlotLayout(
      baseInput({
        bottomLeft: [item(cellSize, cellSize, "a"), item(cellSize, cellSize, "b")],
      }),
    );
    const items = out.placements[0]!.items;
    const cornerX = -R * 0.707;
    const centreGap = cellSize + SLOT_STACK_GAP * R;
    // pinned-negative: content[0] at the corner, content[1] extends left (outward).
    expect(items[0]!.translateX).toBeCloseTo(cornerX, 6);
    expect(items[1]!.translateX).toBeCloseTo(cornerX - centreGap, 6);
  });

  it("stacks bottom slot items vertically downward", () => {
    const h = 0.8;
    const out = computeMarkerSlotLayout(
      baseInput({
        bottom: [item(R, h, "first"), item(R, h, "second")],
      }),
    );
    const items = out.placements[0]!.items;
    const anchorY = R; // no gap — flush against marker
    const halfH = h / 2;
    const centreGap = h + SLOT_STACK_GAP * R;
    // First item centre = anchor + halfH (top edge at anchor)
    expect(items[0]!.translateY).toBeCloseTo(anchorY + halfH, 6);
    expect(items[1]!.translateY).toBeCloseTo(anchorY + halfH + centreGap, 6);
  });

  it("stacks left and right slot items vertically centred on the anchor", () => {
    const h = 1;
    const out = computeMarkerSlotLayout(
      baseInput({
        right: [item(h, h, "a"), item(h, h, "b"), item(h, h, "c")],
      }),
    );
    const items = out.placements[0]!.items;
    expect(items[1]!.translateY).toBeCloseTo(0, 6);
    const centreGap = h + SLOT_STACK_GAP * R;
    expect(items[0]!.translateY).toBeCloseTo(-centreGap, 6);
    expect(items[2]!.translateY).toBeCloseTo(centreGap, 6);
  });
});

describe("computeMarkerSlotLayout — name pill position", () => {
  it("places the name pill at the default Y when bottom slot is empty", () => {
    const out = computeMarkerSlotLayout(
      baseInput({}, { showName: true, nameFontSize: 2 }),
    );
    // Name pill height = nameFontSize * 1.5 = 3
    // lowestDecorationY = r = 4 (no lower-half decorations)
    // nameGap = r * 0.11 = 4 * 0.11 = 0.44
    // nameCentreY = 4 + 0.44 + 1.5 = 5.94
    expect(out.nameCentreY).toBeCloseTo(5.94, 6);
  });

  it("pushes the name pill below a populated bottom slot", () => {
    const out = computeMarkerSlotLayout(
      baseInput({ bottom: [item(R, 1, "strip")] }, { showName: true, nameFontSize: 2 }),
    );
    // bottom anchor = r = 4 (no gap), item h = 1, lowestDecorationY = 4 + 1 = 5
    // nameGap = 0.44, namePillHeight/2 = 1.5
    // nameCentreY = 5 + 0.44 + 1.5 = 6.94
    expect(out.nameCentreY).toBeCloseTo(6.94, 6);
  });

  it("pushes the name pill below bottom-right decorations that hang lower than the glyph", () => {
    const out = computeMarkerSlotLayout(
      baseInput(
        {
          bottomRight: [item(1, 3, "badge")],
        },
        { showName: true, nameFontSize: 2 },
      ),
    );
    // bottomRight item centre sits at y = r*0.707 + gap = 2.828 + 0.6 = 3.428
    // item bottom = 3.428 + 1.5 = 4.928, which protrudes below the glyph edge (r = 4)
    // nameCentreY = 4.928 + 0.44 + 1.5 = 6.868
    expect(out.nameCentreY).toBeCloseTo(6.868, 3);
  });
});

describe("computeMarkerSlotLayout — pitch-edge clamping", () => {
  it("shifts decorations leftward when a right-sided player would overflow", () => {
    // Marker very close to the right edge of a 68-wide pitch. With a
    // corner-anchored bottomRight slot the rightmost content extent is
    // approximately `markerCentreX + r*0.707 + r*0.25` which is easily
    // pushed past the pitch edge by a marker at x=67 with r=4.
    const input = baseInput(
      {
        bottomRight: [item(R, R * 0.8, "a"), item(R, R * 0.8, "b")],
      },
      {
        markerCentreX: 67, // extreme right edge
        markerCentreY: 52,
        pitchSvgWidth: 68,
        pitchSvgHeight: 105,
      },
    );
    const out = computeMarkerSlotLayout(input);
    // Without clamp the rightmost item would overflow; clamp should
    // produce a negative groupShiftX (shift left).
    expect(out.groupShiftX).toBeLessThan(0);
    // The shift should bring the rightmost item inside the clamp margin.
    const rightmostItem = out.placements[0]!.items.reduce((max, it) => {
      const right = it.translateX + it.cellWidth / 2;
      return right > max ? right : max;
    }, -Infinity);
    const absRight = input.markerCentreX + rightmostItem + out.groupShiftX;
    const clampMargin = R * 0.25;
    expect(absRight).toBeLessThanOrEqual(input.pitchSvgWidth - clampMargin + 1e-6);
  });

  it("shifts decorations rightward when a left-edge player would overflow", () => {
    const input = baseInput(
      {
        bottomLeft: [item(R * 1.5, R * 0.72, "wide"), item(R * 1.5, R * 0.72, "wide2")],
      },
      {
        markerCentreX: 3, // near the left edge
        markerCentreY: 40,
        pitchSvgWidth: 68,
        pitchSvgHeight: 105,
      },
    );
    const out = computeMarkerSlotLayout(input);
    expect(out.groupShiftX).toBeGreaterThan(0);
  });

  it("clamps against a non-zero visible x origin for horizontal half crops", () => {
    const input = baseInput(
      {
        bottomRight: [item(R * 1.5, R * 0.72, "wide")],
      },
      {
        markerCentreX: 103,
        markerCentreY: 34,
        pitchSvgMinX: 52.5,
        pitchSvgWidth: 52.5,
        pitchSvgHeight: 68,
      },
    );
    const out = computeMarkerSlotLayout(input);
    expect(out.groupShiftX).toBeLessThan(0);

    const rightmostItem = out.placements[0]!.items.reduce((max, it) => {
      const right = it.translateX + it.cellWidth / 2;
      return right > max ? right : max;
    }, -Infinity);
    const absRight = input.markerCentreX + rightmostItem + out.groupShiftX;
    const clampMargin = R * 0.25;
    expect(absRight).toBeLessThanOrEqual(
      input.pitchSvgMinX! + input.pitchSvgWidth - clampMargin + 1e-6,
    );
  });

  it("does not shift when the marker is well inside the pitch", () => {
    const input = baseInput(
      { topRight: [item(R, R * 0.8, "a")] },
      {
        markerCentreX: 34, // pitch centre
        markerCentreY: 52.5,
        pitchSvgWidth: 68,
        pitchSvgHeight: 105,
      },
    );
    const out = computeMarkerSlotLayout(input);
    expect(out.groupShiftX).toBe(0);
    expect(out.groupShiftY).toBe(0);
  });

  it("centres a bbox wider than the playable strip instead of one-sided overflow", () => {
    // Regression guard for the F1 adversarial finding: with both edges
    // overflowing, the previous implementation overwrote the right-edge
    // shift with the left-edge shift, silently re-overflowing the right.
    // The fix centres the bbox in the available space.
    const input = baseInput(
      {
        // Very wide centred stack that overflows both edges.
        top: [
          item(R * 6, R * 0.8, "a"),
          item(R * 6, R * 0.8, "b"),
          item(R * 6, R * 0.8, "c"),
        ],
      },
      {
        markerCentreX: 20,
        markerCentreY: 20,
        pitchSvgWidth: 40, // tiny pitch — bbox can't possibly fit
        pitchSvgHeight: 40,
      },
    );
    const out = computeMarkerSlotLayout(input);

    // Compute the union of placed items in svg-absolute coords AFTER the shift.
    let absMin = Infinity;
    let absMax = -Infinity;
    for (const placement of out.placements) {
      for (const it of placement.items) {
        const left =
          input.markerCentreX + it.translateX - it.cellWidth / 2 + out.groupShiftX;
        const right =
          input.markerCentreX + it.translateX + it.cellWidth / 2 + out.groupShiftX;
        if (left < absMin) absMin = left;
        if (right > absMax) absMax = right;
      }
    }

    // The bbox should be CENTRED in the playable strip — overflow on
    // both sides should be equal (within float precision).
    const margin = R * 0.25;
    const overLeft = margin - absMin;
    const overRight = absMax - (input.pitchSvgWidth - margin);
    expect(overLeft).toBeCloseTo(overRight, 4);
  });

  it("returns an empty result for r <= 0 (degenerate animation frame)", () => {
    const input = baseInput(
      { top: [item(1, 1, "a")] },
      {
        r: 0,
      },
    );
    const out = computeMarkerSlotLayout(input);
    expect(out.placements).toEqual([]);
    expect(out.groupShiftX).toBe(0);
    expect(out.groupShiftY).toBe(0);
    expect(out.nameCentreY).toBe(0);
    expect(out.nameBottomY).toBe(0);
  });

  it("respects an explicit namePillWidth for clamping (F16)", () => {
    // The clamp must use the actual rendered name pill width — not the
    // old `r * 2` heuristic — so long names on small markers don't
    // clip past the pitch edge.
    const wideName = nameInput(R * 5);
    const out = computeMarkerSlotLayout(wideName);
    // Marker at 34 (centre) on 68-wide pitch, name pill width 20:
    // pill extends from 24 to 44 — well inside, no shift expected.
    expect(out.groupShiftX).toBe(0);

    // Now pull the marker to the right edge. With name pill half-width
    // = 10, the right edge of the pill at marker 64 sits at 74,
    // overflowing 68 - 1 = 67. Expect a leftward shift of at least 7.
    const edgeName = nameInput(R * 5, 64);
    const outEdge = computeMarkerSlotLayout(edgeName);
    expect(outEdge.groupShiftX).toBeLessThanOrEqual(-7);
  });
});

function nameInput(pillWidth: number, markerCentreX = 34): LayoutInput {
  return {
    r: R,
    nameFontSize: 2,
    showName: true,
    namePillWidth: pillWidth,
    markerCentreX,
    markerCentreY: 52,
    pitchSvgWidth: 68,
    pitchSvgHeight: 105,
    slots: {},
  };
}

describe("computeMarkerSlotLayout — slot iteration order", () => {
  it("exposes all 8 slot names in a stable order", () => {
    expect(MARKER_SLOT_NAMES).toHaveLength(8);
    expect(new Set(MARKER_SLOT_NAMES).size).toBe(8);
    for (const name of [
      "top",
      "topRight",
      "right",
      "bottomRight",
      "bottom",
      "bottomLeft",
      "left",
      "topLeft",
    ]) {
      expect(MARKER_SLOT_NAMES).toContain(name);
    }
  });
});

describe("cell-size helpers", () => {
  it("MARKER_ICON_CELL_SIZES returns consistent sizes keyed by kind", () => {
    for (const [kind, fn] of Object.entries(MARKER_ICON_CELL_SIZES)) {
      const size = fn(10);
      expect(size.cellWidth, `${kind} width`).toBeGreaterThan(0);
      expect(size.cellHeight, `${kind} height`).toBeGreaterThan(0);
    }
  });

  it("ratingPillCellSize matches the existing pill dimensions", () => {
    const size = ratingPillCellSize(10);
    expect(size.cellWidth).toBeCloseTo(13.5, 6);
    expect(size.cellHeight).toBeCloseTo(7.2, 6);
  });

  it("markerPillCellHeight scales linearly with r", () => {
    expect(markerPillCellHeight(10)).toBeCloseTo(7.2, 6);
    expect(markerPillCellHeight(20)).toBeCloseTo(14.4, 6);
  });

  it("defaultCustomCellSize returns a square of r × r", () => {
    const size = defaultCustomCellSize(5);
    expect(size.cellWidth).toBe(5);
    expect(size.cellHeight).toBe(5);
  });
});
