import { cleanup, render, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import type { RadarChartRow } from "../src/compute/index.js";

import { RadarChart, ThemeProvider, DARK_THEME } from "../src/index";

afterEach(cleanup);

const STANDARD_ROWS: RadarChartRow[] = [
  { metric: "Goals", value: 0.68, percentile: 92, category: "Attacking" },
  { metric: "npxG", value: 0.54, percentile: 87, category: "Attacking" },
  { metric: "Shots", value: 3.4, percentile: 78, category: "Attacking" },
  { metric: "Passes", value: 22.1, percentile: 45, category: "Possession" },
  { metric: "Carries", value: 2.1, percentile: 71, category: "Possession" },
  { metric: "Tackles", value: 0.9, percentile: 24, category: "Defending" },
  { metric: "Pressures", value: 16.3, percentile: 62, category: "Defending" },
];

const LONG_LABEL_ROWS: RadarChartRow[] = [
  {
    metric: "Expected goals from open play excluding penalties",
    value: 0.68,
    percentile: 92,
    category: "Attacking",
  },
  {
    metric: "Progressive passes received per 90",
    value: 9.1,
    percentile: 84,
    category: "Possession",
  },
  {
    metric: "Counterpress regains in final third",
    value: 3.2,
    percentile: 73,
    category: "Defending",
  },
];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<RadarChart /> — rendering", () => {
  it("renders with correct aria-label", () => {
    const { getByLabelText } = render(<RadarChart rows={STANDARD_ROWS} />);
    expect(getByLabelText("Radar chart: 7 metrics")).toBeInTheDocument();
  });

  it("renders primary polygon", () => {
    const { getByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);
    // `rows` shorthand produces a single series with id 'default'.
    expect(getByTestId("radar-polygon-default")).toBeInTheDocument();
  });

  it("renders rings", () => {
    const { getByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);
    expect(getByTestId("radar-rings")).toBeInTheDocument();
  });

  it("renders spokes", () => {
    const { getByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);
    expect(getByTestId("radar-spokes")).toBeInTheDocument();
  });

  it("renders labels", () => {
    const { getByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);
    expect(getByTestId("radar-labels")).toBeInTheDocument();
  });

  it("renders vertex markers by default", () => {
    const { getByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);
    expect(getByTestId("radar-vertex-default-0")).toBeInTheDocument();
  });

  it("hides vertex markers when showVertexMarkers=false", () => {
    const { queryByTestId } = render(
      <RadarChart rows={STANDARD_ROWS} showVertexMarkers={false} />,
    );
    expect(queryByTestId("radar-vertex-default-0")).toBeNull();
  });

  it("renders empty state", () => {
    const { getByText } = render(<RadarChart rows={[]} />);
    expect(getByText("No profile data")).toBeInTheDocument();
  });

  it("renders an honest fallback note for a single metric", () => {
    const { getByText, queryByTestId } = render(
      <RadarChart rows={[{ metric: "Goals", value: 0.68, percentile: 92 }]} />,
    );

    expect(getByText(/Too few metrics/i)).toBeInTheDocument();
    expect(queryByTestId("radar-polygon")).toBeNull();
  });

  it("renders the same fallback note for a 2-metric input (degenerate polygon avoided)", () => {
    const { getByText, queryByTestId } = render(
      <RadarChart
        rows={[
          { metric: "A", value: 50, percentile: 80 },
          { metric: "B", value: 30, percentile: 20 },
        ]}
      />,
    );

    expect(getByText(/Too few metrics/i)).toBeInTheDocument();
    expect(queryByTestId("radar-polygon")).toBeNull();
  });

  it("keeps long metric labels visible without dropping the label layer", () => {
    const { getByTestId } = render(<RadarChart rows={LONG_LABEL_ROWS} />);
    expect(getByTestId("radar-labels").textContent).toContain(
      "Expected goals from open play excluding penalties",
    );
  });

  it("supports area, guide, and text style injection", () => {
    const { getByTestId } = render(
      <RadarChart
        rows={STANDARD_ROWS}
        areas={{
          fill: "#f472b6",
          stroke: "#be185d",
          strokeWidth: 2,
          markerFill: "#be185d",
        }}
        guides={{
          ringStroke: "#94a3b8",
          ringStrokeWidth: 1,
          ringStrokeDasharray: "4 2",
          spokeStroke: "#64748b",
          spokeStrokeWidth: 0.8,
        }}
        text={{ fill: "#1f2937" }}
      />,
    );

    const polygon = getByTestId("radar-polygon-default").querySelector("path");
    expect(polygon).toHaveAttribute("fill", "#f472b6");
    expect(polygon).toHaveAttribute("stroke", "#be185d");
    expect(polygon).toHaveAttribute("stroke-width", "2");

    const vertex = getByTestId("radar-vertex-default-0");
    expect(vertex).toHaveAttribute("fill", "#be185d");

    const ring = getByTestId("radar-rings").querySelector("path");
    expect(ring).toHaveAttribute("stroke", "#94a3b8");
    expect(ring).toHaveAttribute("stroke-width", "1");
    expect(ring).toHaveAttribute("stroke-dasharray", "4 2");

    const spoke = getByTestId("radar-spokes").querySelector("line");
    expect(spoke).toHaveAttribute("stroke", "#64748b");
    expect(spoke).toHaveAttribute("stroke-width", "0.8");

    const label = getByTestId("radar-labels").querySelector("text");
    expect(label).toHaveAttribute("fill", "#1f2937");
  });
});

// ─── Category legend ────────────────────────────────────────────────

describe("<RadarChart /> — category legend", () => {
  it("renders a legend when 2+ categories are present", () => {
    const { getByTestId } = render(
      <RadarChart
        rows={STANDARD_ROWS}
        categoryColors={["#ff0000", "#00ff00", "#0000ff"]}
      />,
    );
    const legend = getByTestId("radar-legend");
    expect(legend.textContent).toContain("Attacking");
    expect(legend.textContent).toContain("Possession");
    expect(legend.textContent).toContain("Defending");
  });

  it("does not render a legend for a single-category profile", () => {
    const rows = [
      { metric: "Goals", value: 1, percentile: 90, category: "Attacking" },
      { metric: "Shots", value: 3, percentile: 80, category: "Attacking" },
      { metric: "xG", value: 0.5, percentile: 85, category: "Attacking" },
    ];
    const { queryByTestId } = render(<RadarChart rows={rows} />);
    expect(queryByTestId("radar-legend")).toBeNull();
  });

  it("suppresses the legend when showLegend=false", () => {
    const { queryByTestId } = render(
      <RadarChart rows={STANDARD_ROWS} showLegend={false} />,
    );
    expect(queryByTestId("radar-legend")).toBeNull();
  });
});

// ─── Interaction ────────────────────────────────────────────────────

describe("<RadarChart /> — interaction", () => {
  it("shows tooltip on vertex hover", () => {
    const { getByTestId, queryByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);

    expect(queryByTestId("radar-tooltip")).toBeNull();
    fireEvent.mouseEnter(getByTestId("radar-vertex-hit-0"));
    expect(getByTestId("radar-tooltip")).toBeInTheDocument();
    expect(getByTestId("radar-tooltip").textContent).toContain("Goals");
  });

  it("hides tooltip on mouse leave", () => {
    const { getByTestId, queryByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);

    fireEvent.mouseEnter(getByTestId("radar-vertex-hit-0"));
    expect(queryByTestId("radar-tooltip")).not.toBeNull();

    const container = getByTestId("radar-vertex-hit-0").closest("div");
    if (container) fireEvent.mouseLeave(container);
    expect(queryByTestId("radar-tooltip")).toBeNull();
  });

  it("shows tooltip on vertex focus", () => {
    const { getByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);

    fireEvent.focus(getByTestId("radar-vertex-hit-0"));

    expect(getByTestId("radar-tooltip").textContent).toContain("Goals");
  });
});

// ─── Theme ──────────────────────────────────────────────────────────

describe("<RadarChart /> — theme", () => {
  it("uses dark theme grid color", () => {
    const { getByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <RadarChart rows={STANDARD_ROWS} />
      </ThemeProvider>,
    );
    const rings = getByTestId("radar-rings");
    const paths = rings.querySelectorAll("path");
    expect(paths[0]!.getAttribute("stroke")).toBe(DARK_THEME.axis.grid);
  });
});

// ─── Ring styles ────────────────────────────────────────────────────

describe("<RadarChart /> — ring styles", () => {
  it("renders bands for banded style", () => {
    const { getByTestId } = render(
      <RadarChart rows={STANDARD_ROWS} ringStyle="banded" />,
    );
    expect(getByTestId("radar-bands")).toBeInTheDocument();
  });

  it("does not clip bands for full-circle banded style", () => {
    const { getByTestId } = render(
      <RadarChart rows={STANDARD_ROWS} ringStyle="banded" />,
    );
    expect(getByTestId("radar-bands").getAttribute("clip-path")).toBeNull();
  });

  it("clips bands to the polygon for banded-inside-polygon style", () => {
    const { getByTestId } = render(
      <RadarChart rows={STANDARD_ROWS} ringStyle="banded-inside-polygon" />,
    );
    const clipAttr = getByTestId("radar-bands").getAttribute("clip-path");
    expect(clipAttr).toMatch(/^url\(#radar-bands-clip-/);
  });

  it("defaults polygon fill to transparent in banded-inside-polygon (bands show through)", () => {
    const { getByTestId } = render(
      <RadarChart rows={STANDARD_ROWS} ringStyle="banded-inside-polygon" />,
    );
    const polygonPath = getByTestId("radar-polygon-default").querySelector("path");
    expect(polygonPath).toHaveAttribute("fill", "transparent");
  });

  it("honors areas.fill override even in banded-inside-polygon mode", () => {
    const { getByTestId } = render(
      <RadarChart
        rows={STANDARD_ROWS}
        ringStyle="banded-inside-polygon"
        areas={{ fill: "#ff0088" }}
      />,
    );
    const polygonPath = getByTestId("radar-polygon-default").querySelector("path");
    expect(polygonPath).toHaveAttribute("fill", "#ff0088");
  });

  it("does not emit a bands clip-path when polygon is absent (sparse fallback)", () => {
    const { queryByTestId } = render(
      <RadarChart
        rows={[{ metric: "Goals", value: 1, percentile: 90 }]}
        ringStyle="banded-inside-polygon"
      />,
    );
    expect(queryByTestId("radar-bands")?.getAttribute("clip-path") ?? null).toBeNull();
  });

  it("renders outer background bands when outerRingColors is provided with banded-inside-polygon", () => {
    const { getByTestId } = render(
      <RadarChart
        rows={STANDARD_ROWS}
        ringStyle="banded-inside-polygon"
        outerRingColors={["#eeeeee", "#dddddd"]}
      />,
    );
    const outerBands = getByTestId("radar-outer-bands");
    expect(outerBands).toBeInTheDocument();
    expect(outerBands.getAttribute("clip-path")).toBeNull();
    const firstPath = outerBands.querySelector("path");
    expect(firstPath).toHaveAttribute("fill", "#eeeeee");
  });

  it("does not render outer bands for plain banded style", () => {
    const { queryByTestId } = render(
      <RadarChart
        rows={STANDARD_ROWS}
        ringStyle="banded"
        outerRingColors={["#eeeeee", "#dddddd"]}
      />,
    );
    expect(queryByTestId("radar-outer-bands")).toBeNull();
  });

  it("inverts tick labels inside the polygon in banded-inside-polygon mode", () => {
    const rows: RadarChartRow[] = [
      { metric: "A", value: 8, min: 0, max: 10 },
      { metric: "B", value: 8, min: 0, max: 10 },
      { metric: "C", value: 8, min: 0, max: 10 },
    ];
    const { getByTestId } = render(
      <RadarChart rows={rows} valueMode="range" ringStyle="banded-inside-polygon" />,
    );
    const ticks = getByTestId("radar-spoke-ticks").querySelectorAll("text");
    const anyInside = Array.from(ticks).some(
      (t) => t.getAttribute("data-inside-polygon") === "true",
    );
    const anyOutside = Array.from(ticks).some(
      (t) => t.getAttribute("data-inside-polygon") === "false",
    );
    expect(anyInside).toBe(true);
    expect(anyOutside).toBe(true);
    const insideTick = Array.from(ticks).find(
      (t) => t.getAttribute("data-inside-polygon") === "true",
    );
    expect(insideTick).toHaveAttribute("fill", "#ffffff");
    expect(insideTick).toHaveAttribute("font-weight", "700");
  });

  it("uses a denser default ringSteps for banded styles", () => {
    const { getByTestId } = render(
      <RadarChart rows={STANDARD_ROWS} ringStyle="banded" />,
    );
    const bands = getByTestId("radar-bands");
    // 9 default steps -> 10 bands
    expect(bands.querySelectorAll("path").length).toBe(10);
  });

  it("renders each band as an annular even-odd path so inner colors survive", () => {
    const { getByTestId } = render(
      <RadarChart
        rows={STANDARD_ROWS}
        ringStyle="banded"
        ringColors={["#ff0000", "#00ff00"]}
      />,
    );
    const paths = getByTestId("radar-bands").querySelectorAll("path");
    // Alternating red/green must both survive — if bands render as full
    // circles (the earlier bug) only the outermost color is visible.
    const fills = Array.from(paths).map((p) => p.getAttribute("fill"));
    expect(fills).toContain("#ff0000");
    expect(fills).toContain("#00ff00");
    // Non-innermost paths must use even-odd so the annulus is preserved.
    const nonInnermost = Array.from(paths).slice(1);
    for (const p of nonInnermost) {
      expect(p.getAttribute("fill-rule")).toBe("evenodd");
    }
  });

  it("applies text.fill to non-inverted tick labels (so `text={{fill:'#000'}}` gives black ticks)", () => {
    const rows: RadarChartRow[] = [
      { metric: "A", value: 2, min: 0, max: 10, displayValue: "2" },
      { metric: "B", value: 2, min: 0, max: 10, displayValue: "2" },
      { metric: "C", value: 2, min: 0, max: 10, displayValue: "2" },
    ];
    const { getByTestId } = render(
      <RadarChart
        rows={rows}
        valueMode="range"
        ringStyle="banded-inside-polygon"
        text={{ fill: "#000000" }}
      />,
    );
    const ticks = getByTestId("radar-spoke-ticks").querySelectorAll("text");
    const outsideTick = Array.from(ticks).find(
      (t) => t.getAttribute("data-inside-polygon") === "false",
    );
    expect(outsideTick).toHaveAttribute("fill", "#000000");
  });
});

// ─── Range-mode tooltip ─────────────────────────────────────────────

describe("<RadarChart /> — range-mode tooltip", () => {
  it("shows per-axis range in the tooltip when valueMode=range", () => {
    const rows: RadarChartRow[] = [
      { metric: "A", value: 3, min: 0, max: 10, displayValue: "3" },
      { metric: "B", value: 5, min: 0, max: 10, displayValue: "5" },
      { metric: "C", value: 7, min: 0, max: 10, displayValue: "7" },
    ];
    const { getByTestId } = render(<RadarChart rows={rows} valueMode="range" />);
    fireEvent.mouseEnter(getByTestId("radar-vertex-hit-0"));
    const tooltip = getByTestId("radar-tooltip");
    expect(tooltip.textContent).toContain("Range");
    expect(tooltip.textContent).toContain("0");
    expect(tooltip.textContent).toContain("10");
  });

  it("labels the range 'lower is better' when lowerIsBetter is set", () => {
    const rows: RadarChartRow[] = [
      {
        metric: "Dispossessed",
        value: 2,
        min: 0,
        max: 3,
        displayValue: "2",
        lowerIsBetter: true,
      },
      { metric: "B", value: 5, min: 0, max: 10, displayValue: "5" },
      { metric: "C", value: 7, min: 0, max: 10, displayValue: "7" },
    ];
    const { getByTestId } = render(<RadarChart rows={rows} valueMode="range" />);
    fireEvent.mouseEnter(getByTestId("radar-vertex-hit-0"));
    expect(getByTestId("radar-tooltip").textContent).toContain("lower is better");
  });

  it("does not add a range row in percentile mode", () => {
    const { getByTestId } = render(<RadarChart rows={STANDARD_ROWS} />);
    fireEvent.mouseEnter(getByTestId("radar-vertex-hit-0"));
    expect(getByTestId("radar-tooltip").textContent).not.toContain("Range");
  });
});

// ─── Multi-profile comparison ──────────────────────────────────────

describe("<RadarChart /> — multi-profile", () => {
  const SERIES_A: RadarChartRow[] = [
    { metric: "Goals", value: 0.7, percentile: 90 },
    { metric: "Shots", value: 3, percentile: 70 },
    { metric: "Passes", value: 20, percentile: 40 },
  ];
  const SERIES_B: RadarChartRow[] = [
    { metric: "Goals", value: 0.3, percentile: 45 },
    { metric: "Shots", value: 4.5, percentile: 90 },
    { metric: "Passes", value: 28, percentile: 80 },
  ];

  it("renders one polygon per series with distinct testIds", () => {
    const { getByTestId } = render(
      <RadarChart
        series={[
          { id: "a", label: "Player A", rows: SERIES_A },
          { id: "b", label: "Player B", rows: SERIES_B },
        ]}
      />,
    );
    expect(getByTestId("radar-polygon-a")).toBeInTheDocument();
    expect(getByTestId("radar-polygon-b")).toBeInTheDocument();
  });

  it("assigns distinct default colours across series", () => {
    const { getByTestId } = render(
      <RadarChart
        series={[
          { id: "a", label: "A", rows: SERIES_A },
          { id: "b", label: "B", rows: SERIES_B },
        ]}
      />,
    );
    const fillA = getByTestId("radar-polygon-a")
      .querySelector("path")
      ?.getAttribute("fill");
    const fillB = getByTestId("radar-polygon-b")
      .querySelector("path")
      ?.getAttribute("fill");
    expect(fillA).not.toBe(fillB);
  });

  it("emits a series legend when 2+ labelled series are supplied", () => {
    const { getByTestId } = render(
      <RadarChart
        series={[
          { id: "a", label: "Garnacho", rows: SERIES_A },
          { id: "b", label: "Doku", rows: SERIES_B },
        ]}
      />,
    );
    // The chart emits one ChartLegend per legend model; the series legend
    // carries the player labels.
    const body = getByTestId("radar-polygon-a").closest('[data-slot="frame"]');
    expect(body?.textContent).toContain("Garnacho");
    expect(body?.textContent).toContain("Doku");
  });

  it("tooltip lists all series values at the hovered slot", () => {
    const { getByTestId } = render(
      <RadarChart
        series={[
          { id: "a", label: "Garnacho", rows: SERIES_A },
          { id: "b", label: "Doku", rows: SERIES_B },
        ]}
      />,
    );
    fireEvent.mouseEnter(getByTestId("radar-vertex-hit-0"));
    const tooltip = getByTestId("radar-tooltip");
    expect(tooltip.textContent).toContain("Garnacho");
    expect(tooltip.textContent).toContain("Doku");
  });

  it("treats rows as shorthand for a single default series", () => {
    const { getByTestId, queryByTestId } = render(<RadarChart rows={SERIES_A} />);
    expect(getByTestId("radar-polygon-default")).toBeInTheDocument();
    expect(queryByTestId("radar-polygon-a")).toBeNull();
  });

  it("honours explicit series colour overrides", () => {
    const { getByTestId } = render(
      <RadarChart
        series={[
          { id: "a", label: "A", rows: SERIES_A, color: "#ff00aa" },
          { id: "b", label: "B", rows: SERIES_B },
        ]}
      />,
    );
    const fillA = getByTestId("radar-polygon-a")
      .querySelector("path")
      ?.getAttribute("fill");
    expect(fillA).toBe("#ff00aa");
  });

  it("renders vertex value pills when showVertexValues is true", () => {
    const { getByTestId } = render(
      <RadarChart
        series={[
          { id: "a", label: "A", rows: SERIES_A },
          { id: "b", label: "B", rows: SERIES_B },
        ]}
        showVertexValues
      />,
    );
    const pills = getByTestId("radar-vertex-value-pills");
    // Two series × three metrics = six pills (one text per pill).
    expect(pills.querySelectorAll("text").length).toBe(6);
  });

  it("does not render vertex value pills by default", () => {
    const { queryByTestId } = render(<RadarChart rows={SERIES_A} />);
    expect(queryByTestId("radar-vertex-value-pills")).toBeNull();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<RadarChart /> — accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<RadarChart rows={STANDARD_ROWS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations for empty state", async () => {
    const { container } = render(<RadarChart rows={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
