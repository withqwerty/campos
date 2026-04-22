import { Fragment } from "react";

import { describe, expect, it } from "vitest";

import { normaliseSlotContent } from "../src/formation/slotMeasurement";
import { MarkerPill } from "../src/primitives/MarkerPill";

describe("Formation slot measurement", () => {
  it("flattens fragments into individual slot items", () => {
    const items = normaliseSlotContent(
      <Fragment>
        <MarkerPill r={3} text="A" />
        <MarkerPill r={3} text="B" />
      </Fragment>,
      3,
    );

    expect(items).toHaveLength(2);
  });

  it("preserves literal zero content instead of dropping it as falsy", () => {
    const items = normaliseSlotContent(0, 3);

    expect(items).toHaveLength(1);
    expect(items[0]?.cellWidth).toBeGreaterThan(0);
    expect(items[0]?.cellHeight).toBeGreaterThan(0);
  });
});
