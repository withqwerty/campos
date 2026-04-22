import { describe, expect, it } from "vitest";

import {
  EVENT_REF_ACCENT,
  EVENT_REF_SUBTLE,
  diagonalFromLinear,
  diagonalSeries,
  envelopeCenterOffset,
  eventRef,
} from "../src/helpers";

describe("helpers", () => {
  it("eventRef defaults to a solid blue vertical with no dash", () => {
    const r = eventRef(10, { label: "New boss" });
    expect(r.kind).toBe("vertical");
    if (r.kind !== "vertical") return;
    expect(r.x).toBe(10);
    expect(r.label).toBe("New boss");
    expect(r.stroke).toBe("#3f7cc4");
    expect(r.strokeDasharray).toBeUndefined();
  });

  it("eventRef accepts an unlabelled x only", () => {
    const r = eventRef(5);
    expect(r.kind).toBe("vertical");
    if (r.kind !== "vertical") return;
    expect(r.x).toBe(5);
    expect(r.label).toBeUndefined();
  });

  it("eventRef with EVENT_REF_SUBTLE renders dashed grey", () => {
    const r = eventRef(5, EVENT_REF_SUBTLE);
    expect(r.kind).toBe("vertical");
    if (r.kind !== "vertical") return;
    expect(r.stroke).toBe("#9ca3af");
    expect(r.strokeDasharray).toBe("4 3");
  });

  it("eventRef with EVENT_REF_ACCENT renders bold red", () => {
    const r = eventRef(42, { label: "Goal", ...EVENT_REF_ACCENT });
    expect(r.kind).toBe("vertical");
    if (r.kind !== "vertical") return;
    expect(r.stroke).toBe("#c8102e");
    expect(r.strokeWidth).toBe(1.5);
    expect(r.label).toBe("Goal");
  });

  it("eventRef lets callers supply arbitrary stroke / dash overrides", () => {
    const r = eventRef(7, {
      label: "Injury",
      stroke: "#00a650",
      strokeDasharray: "2 2",
    });
    expect(r.kind).toBe("vertical");
    if (r.kind !== "vertical") return;
    expect(r.stroke).toBe("#00a650");
    expect(r.strokeDasharray).toBe("2 2");
  });

  it("diagonalFromLinear evaluates slope/intercept across xDomain", () => {
    const d = diagonalFromLinear(2, 1, [0, 10]);
    expect(d.kind).toBe("diagonal");
    if (d.kind !== "diagonal") return;
    expect(d.from).toEqual([0, 1]);
    expect(d.to).toEqual([10, 21]);
  });

  it("diagonalFromLinear merges extra styling without overriding geometry", () => {
    const d = diagonalFromLinear(1, 0, [0, 1], {
      label: "Equality",
      strokeDasharray: "2 2",
    });
    expect(d.kind).toBe("diagonal");
    if (d.kind !== "diagonal") return;
    expect(d.label).toBe("Equality");
    expect(d.strokeDasharray).toBe("2 2");
    expect(d.from).toEqual([0, 0]);
    expect(d.to).toEqual([1, 1]);
  });

  it("envelopeCenterOffset produces center-offset bounds aligned to series", () => {
    const centre = [
      { x: 0, y: 10 },
      { x: 1, y: 11 },
      { x: 2, y: 12 },
    ];
    const env = envelopeCenterOffset("c", centre, [1, 1.5, 2], [-1, -1.5, -2], {
      fill: "#888",
    });
    expect(env.kind).toBe("center-offset");
    if (env.kind !== "center-offset") return;
    expect(env.centerSeriesId).toBe("c");
    expect(env.bounds.length).toBe(3);
    expect(env.bounds[0]).toEqual({ x: 0, upper: 11, lower: 9 });
    expect(env.fill).toBe("#888");
  });

  it("diagonalSeries yields hidden series with two points", () => {
    const s = diagonalSeries("eq", [0, 0], [100, 100], { label: "Equality" });
    expect(s.hidden).toBe(true);
    expect(s.points.length).toBe(2);
    expect(s.label).toBe("Equality");
  });
});
