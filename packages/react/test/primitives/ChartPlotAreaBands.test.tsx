import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ChartPlotAreaBands,
  type PlotAreaBand,
} from "../../src/primitives/ChartPlotAreaBands";
import { LIGHT_THEME } from "../../src/theme";

const plotArea = { x: 50, y: 20, width: 300, height: 200 };
const xDomain: [number, number] = [0, 100];
const yDomain: [number, number] = [0, 100];

function renderBands(bands: readonly PlotAreaBand[], onWarn?: (m: string) => void) {
  return render(
    <svg>
      <ChartPlotAreaBands
        plotArea={plotArea}
        xDomain={xDomain}
        yDomain={yDomain}
        bands={bands}
        theme={LIGHT_THEME}
        {...(onWarn ? { onWarn } : {})}
      />
    </svg>,
  );
}

describe("ChartPlotAreaBands", () => {
  it("renders nothing when bands is empty", () => {
    const { container } = renderBands([]);
    expect(container.querySelector("[data-testid='plot-bands']")).toBeNull();
  });

  it("renders a single y-band covering the full plot width", () => {
    const { container } = renderBands([
      { axis: "y", range: [20, 40], label: "Zone", id: "zone" },
    ]);
    const rect = container.querySelector("[data-testid='plot-band-zone']");
    expect(rect).not.toBeNull();
    expect(Number(rect!.getAttribute("x"))).toBe(plotArea.x);
    expect(Number(rect!.getAttribute("width"))).toBe(plotArea.width);
  });

  it("normalises inverted range silently", () => {
    const warn = vi.fn();
    renderBands([{ axis: "y", range: [60, 20] }], warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it("clips range beyond domain to plot area", () => {
    const { container } = renderBands([{ axis: "y", range: [-50, 150], id: "full" }]);
    const rect = container.querySelector("[data-testid='plot-band-full']");
    expect(rect).not.toBeNull();
    expect(Number(rect!.getAttribute("y"))).toBeCloseTo(plotArea.y, 0);
    expect(Number(rect!.getAttribute("height"))).toBeCloseTo(plotArea.height, 0);
  });

  it("drops range entirely outside domain with [band.out-of-domain]", () => {
    const warn = vi.fn();
    const { container } = renderBands(
      [{ axis: "y", range: [200, 300], label: "nope" }],
      warn,
    );
    expect(container.querySelector("rect")).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[band.out-of-domain]"));
  });

  it("drops zero-width range with [band.zero-width]", () => {
    const warn = vi.fn();
    const { container } = renderBands([{ axis: "y", range: [50, 50] }], warn);
    expect(container.querySelector("rect")).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[band.zero-width]"));
  });

  it("drops non-finite bounds with [band.out-of-domain]", () => {
    const warn = vi.fn();
    renderBands([{ axis: "y", range: [NaN, 10] }], warn);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[band.out-of-domain]"));
  });

  it("renders x and y bands in the same chart (mixed axis)", () => {
    const { container } = renderBands([
      { axis: "x", range: [10, 30], id: "x1" },
      { axis: "y", range: [20, 40], id: "y1" },
    ]);
    expect(container.querySelector("[data-testid='plot-band-x1']")).not.toBeNull();
    expect(container.querySelector("[data-testid='plot-band-y1']")).not.toBeNull();
  });

  it("renders overlapping bands with later entries last (on top)", () => {
    const { container } = renderBands([
      { axis: "y", range: [20, 40], id: "low" },
      { axis: "y", range: [30, 50], id: "high" },
    ]);
    const rects = Array.from(container.querySelectorAll("rect"));
    const lowIdx = rects.findIndex(
      (r) => r.getAttribute("data-testid") === "plot-band-low",
    );
    const highIdx = rects.findIndex(
      (r) => r.getAttribute("data-testid") === "plot-band-high",
    );
    expect(lowIdx).toBeLessThan(highIdx);
  });

  it("auto-flips labelPlacement to 'above' for narrow bands (<24px on-axis)", () => {
    // 1 unit out of 100 on a 200px axis = 2px → narrow
    const { container } = renderBands([
      { axis: "y", range: [50, 51], label: "narrow", id: "n" },
    ]);
    const text = container.querySelector("text");
    expect(text).not.toBeNull();
    const rect = container.querySelector("[data-testid='plot-band-n']") as SVGRectElement;
    // "above" places the label above the band's top edge (not inside).
    const rectTop = Number(rect.getAttribute("y"));
    const labelY = Number(text!.getAttribute("y"));
    expect(labelY).toBeLessThan(rectTop);
  });

  it("suppresses lower-priority inside labels when they collide", () => {
    const warn = vi.fn();
    renderBands(
      [
        { axis: "y", range: [40, 60], label: "A", id: "A", labelPriority: 5 },
        { axis: "y", range: [40, 60], label: "B", id: "B", labelPriority: 1 },
      ],
      warn,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[band.label-suppressed]"));
  });

  it("breaks priority ties by input order (later input is suppressed)", () => {
    const warn = vi.fn();
    renderBands(
      [
        { axis: "y", range: [40, 60], label: "first", id: "first", labelPriority: 1 },
        { axis: "y", range: [40, 60], label: "second", id: "second", labelPriority: 1 },
      ],
      warn,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("second"));
  });

  it("passes multibyte / emoji labels through unchanged", () => {
    const { container } = renderBands([
      { axis: "y", range: [20, 40], label: "🟢 Title 中文", id: "mb" },
    ]);
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("🟢 Title 中文");
  });

  it("emits aria-label on labelled bands", () => {
    const { container } = renderBands([
      { axis: "y", range: [20, 40], label: "Accessible", id: "a" },
    ]);
    const text = container.querySelector("text[aria-label='Accessible']");
    expect(text).not.toBeNull();
  });

  it("emits <title> on labelled bands (tooltip)", () => {
    const { container } = renderBands([
      { axis: "y", range: [20, 40], label: "TitleTip", id: "t" },
    ]);
    expect(container.querySelector("title")?.textContent).toBe("TitleTip");
  });

  it("respects per-band fill / opacity overrides", () => {
    const { container } = renderBands([
      { axis: "y", range: [20, 40], id: "c", fill: "#ff0000", opacity: 0.5 },
    ]);
    const rect = container.querySelector("[data-testid='plot-band-c']");
    expect(rect?.getAttribute("fill")).toBe("#ff0000");
    expect(rect?.getAttribute("opacity")).toBe("0.5");
  });
});
