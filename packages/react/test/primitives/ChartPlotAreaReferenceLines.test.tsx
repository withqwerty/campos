import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ChartPlotAreaReferenceLines,
  type PlotAreaReferenceLine,
} from "../../src/primitives/ChartPlotAreaReferenceLines";
import { LIGHT_THEME } from "../../src/theme";

const plotArea = { x: 50, y: 20, width: 300, height: 200 };
const xDomain: [number, number] = [0, 100];
const yDomain: [number, number] = [0, 100];

function renderLines(
  lines: readonly PlotAreaReferenceLine[],
  opts: { onWarn?: (m: string) => void; layer?: "body" | "labels" | "both" } = {},
) {
  return render(
    <svg>
      <ChartPlotAreaReferenceLines
        plotArea={plotArea}
        xDomain={xDomain}
        yDomain={yDomain}
        lines={lines}
        theme={LIGHT_THEME}
        {...(opts.onWarn ? { onWarn: opts.onWarn } : {})}
        {...(opts.layer ? { layer: opts.layer } : {})}
      />
    </svg>,
  );
}

describe("ChartPlotAreaReferenceLines", () => {
  it("renders nothing when lines is empty", () => {
    const { container } = renderLines([]);
    expect(container.querySelector("[data-testid='plot-references']")).toBeNull();
  });

  it("renders a horizontal reference line", () => {
    const { container } = renderLines([{ kind: "horizontal", y: 50, id: "h" }]);
    const line = container.querySelector("[data-testid='plot-reference-h']");
    expect(line).not.toBeNull();
    expect(Number(line!.getAttribute("x1"))).toBe(plotArea.x);
    expect(Number(line!.getAttribute("x2"))).toBe(plotArea.x + plotArea.width);
  });

  it("renders a vertical reference line", () => {
    const { container } = renderLines([{ kind: "vertical", x: 25, id: "v" }]);
    const line = container.querySelector("[data-testid='plot-reference-v']");
    expect(line).not.toBeNull();
    expect(Number(line!.getAttribute("y1"))).toBe(plotArea.y);
    expect(Number(line!.getAttribute("y2"))).toBe(plotArea.y + plotArea.height);
  });

  it("renders a diagonal reference line fully inside the plot", () => {
    const { container } = renderLines([
      { kind: "diagonal", from: [0, 0], to: [100, 100], id: "eq" },
    ]);
    const line = container.querySelector("[data-testid='plot-reference-eq']");
    expect(line).not.toBeNull();
  });

  it("drops horizontal with y outside domain + [reference.out-of-domain]", () => {
    const warn = vi.fn();
    const { container } = renderLines([{ kind: "horizontal", y: 200 }], { onWarn: warn });
    expect(container.querySelector("line")).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[reference.out-of-domain]"),
    );
  });

  it("drops vertical with x outside domain + [reference.out-of-domain]", () => {
    const warn = vi.fn();
    const { container } = renderLines([{ kind: "vertical", x: -10 }], { onWarn: warn });
    expect(container.querySelector("line")).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[reference.out-of-domain]"),
    );
  });

  it("drops diagonal with from === to + [reference.degenerate]", () => {
    const warn = vi.fn();
    renderLines([{ kind: "diagonal", from: [10, 10], to: [10, 10] }], { onWarn: warn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[reference.degenerate]"));
  });

  it("drops diagonal with non-finite coordinates + [reference.degenerate]", () => {
    const warn = vi.fn();
    renderLines([{ kind: "diagonal", from: [Number.NaN, 0], to: [100, 100] }], {
      onWarn: warn,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[reference.degenerate]"));
  });

  it("clips diagonal both-outside chord that intersects plot", () => {
    // Line y = x; domain 0..100; outside endpoints would be (-20,-20) and (120,120)
    const { container } = renderLines([
      { kind: "diagonal", from: [-20, -20], to: [120, 120], id: "clipped" },
    ]);
    const line = container.querySelector("[data-testid='plot-reference-clipped']");
    expect(line).not.toBeNull();
  });

  it("drops diagonal grazing corner + [reference.no-plot-intersection]", () => {
    const warn = vi.fn();
    // Points (-10, 100) and (0, 110) in data-space map to SVG.
    // Using data-space: line passes through (0, 100) corner only.
    renderLines([{ kind: "diagonal", from: [-10, 100], to: [0, 110] }], {
      onWarn: warn,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[reference.no-plot-intersection]"),
    );
  });

  it("layer='body' renders only lines, no labels", () => {
    const { container } = renderLines(
      [{ kind: "horizontal", y: 50, label: "Mid", id: "m" }],
      { layer: "body" },
    );
    expect(container.querySelector("[data-testid='plot-reference-m']")).not.toBeNull();
    expect(container.querySelector("[data-testid='plot-reference-label-m']")).toBeNull();
  });

  it("layer='labels' renders only labels, no line bodies", () => {
    const { container } = renderLines(
      [{ kind: "horizontal", y: 50, label: "Mid", id: "m" }],
      { layer: "labels" },
    );
    expect(container.querySelector("[data-testid='plot-reference-m']")).toBeNull();
    expect(
      container.querySelector("[data-testid='plot-reference-label-m']"),
    ).not.toBeNull();
  });

  it("layer='both' (default) renders both", () => {
    const { container } = renderLines([
      { kind: "horizontal", y: 50, label: "Mid", id: "m" },
    ]);
    expect(container.querySelector("[data-testid='plot-reference-m']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='plot-reference-label-m']"),
    ).not.toBeNull();
  });

  it("applies per-line stroke / dasharray / opacity overrides", () => {
    const { container } = renderLines([
      {
        kind: "horizontal",
        y: 50,
        id: "styled",
        stroke: "#ff0000",
        strokeDasharray: "2 2",
        opacity: 0.9,
        strokeWidth: 2,
      },
    ]);
    const line = container.querySelector("[data-testid='plot-reference-styled']");
    expect(line?.getAttribute("stroke")).toBe("#ff0000");
    expect(line?.getAttribute("stroke-dasharray")).toBe("2 2");
    expect(line?.getAttribute("opacity")).toBe("0.9");
    expect(line?.getAttribute("stroke-width")).toBe("2");
  });

  it("renders aria-label and <title> on labelled references", () => {
    const { container } = renderLines([
      { kind: "horizontal", y: 50, label: "Threshold", id: "t" },
    ]);
    expect(container.querySelector("title")?.textContent).toBe("Threshold");
    expect(container.querySelector("[aria-label='Threshold']")).not.toBeNull();
  });
});
