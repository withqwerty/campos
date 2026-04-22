import { cleanup, fireEvent, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import {
  EVENT_REF_SUBTLE,
  LineChart,
  LineChartStaticSvg,
  eventRef,
  type LineChartEndLabelRenderProps,
  type LineChartSeriesModel,
} from "../src/index";

afterEach(cleanup);

const series = [
  {
    id: "xg",
    label: "xG",
    points: [
      { x: 1, y: 1.4 },
      { x: 2, y: 1.96 },
      { x: 3, y: 0.3 },
      { x: 4, y: 1.19 },
    ],
  },
  {
    id: "xga",
    label: "xGA",
    points: [
      { x: 1, y: 0.32 },
      { x: 2, y: 0.65 },
      { x: 3, y: 0.68 },
      { x: 4, y: 0.38 },
    ],
  },
];

describe("<LineChart />", () => {
  it("renders with an accessible summary label", () => {
    const { getByLabelText } = render(<LineChart series={series} />);
    expect(getByLabelText(/line chart/i)).toBeInTheDocument();
  });

  it("renders empty state when no series are provided", () => {
    const { getByText } = render(<LineChart series={[]} />);
    expect(getByText("No data")).toBeInTheDocument();
  });

  it("renders end labels for each series", () => {
    const { getByTestId } = render(<LineChart series={series} />);
    const labels = getByTestId("line-end-labels");
    expect(labels.textContent).toContain("xG");
    expect(labels.textContent).toContain("xGA");
  });

  it("renders trendlines when enabled", () => {
    const { getByTestId } = render(<LineChart series={series} trendlines={true} />);
    expect(getByTestId("line-trendlines")).toBeInTheDocument();
  });

  it("omits the trendline group when no series have a trendline", () => {
    const { queryByTestId } = render(<LineChart series={series} />);
    expect(queryByTestId("line-trendlines")).toBeNull();
  });

  it("renders reference lines when provided", () => {
    const { getByTestId } = render(
      <LineChart
        series={series}
        references={[
          eventRef(2, { label: "Change of Manager" }),
          eventRef(3, EVENT_REF_SUBTLE),
        ]}
      />,
    );
    const refs = getByTestId("line-references");
    expect(refs).toBeInTheDocument();
    // Label lives in the elevated labels layer
    const labels = getByTestId("line-reference-labels");
    expect(labels.textContent).toContain("Change of Manager");
  });

  it("renders a mirror y2 axis when dualYAxis is true", () => {
    const { getByTestId } = render(<LineChart series={series} dualYAxis={true} />);
    expect(getByTestId("line-y2-axis")).toBeInTheDocument();
  });

  it("omits the mirror y2 axis when dualYAxis is false", () => {
    const { queryByTestId } = render(<LineChart series={series} />);
    expect(queryByTestId("line-y2-axis")).toBeNull();
  });

  it("wraps series paths in a clip-path bound to the plot area", () => {
    const { container } = render(<LineChart series={series} />);
    const clipWrapper = container.querySelector("g[clip-path]");
    expect(clipWrapper).toBeInTheDocument();
    expect(clipWrapper?.getAttribute("clip-path")).toMatch(/^url\(#line-plot-clip-/);
    // The clipPath definition lives in defs next to a rect covering the plot area.
    const clipPath = container.querySelector("defs clipPath");
    expect(clipPath?.querySelector("rect")).toBeInTheDocument();
  });

  it("shifts end labels past the mirrored tick strip when dualYAxis is on", () => {
    const { getByTestId, rerender } = render(<LineChart series={series} />);
    const noDual = (
      getByTestId("line-end-labels").firstElementChild as HTMLElement | null
    )?.style.left;
    rerender(<LineChart series={series} dualYAxis={true} />);
    const withDual = (
      getByTestId("line-end-labels").firstElementChild as HTMLElement | null
    )?.style.left;
    expect(noDual).toBeDefined();
    expect(withDual).toBeDefined();
    expect(parseFloat(withDual!)).toBeGreaterThan(parseFloat(noDual!));
  });

  it("hides grid lines when showGridLines is false", () => {
    const { queryByTestId } = render(<LineChart series={series} showGridLines={false} />);
    expect(queryByTestId("line-y-grid")).toBeNull();
  });

  it("invokes a custom renderEndLabel with series identity and value", () => {
    const rendered: LineChartEndLabelRenderProps[] = [];
    render(
      <LineChart
        series={series}
        renderEndLabel={(props) => {
          rendered.push(props);
          return <span data-testid={`custom-${props.id}`}>{props.label}</span>;
        }}
      />,
    );
    expect(rendered.map((p) => p.id).sort()).toEqual(["xg", "xga"]);
    // Value reflects the last point's y
    const xgCall = rendered.find((p) => p.id === "xg");
    expect(xgCall?.value).toBeCloseTo(1.19);
  });

  it("honours per-point markerKind as a default shape", () => {
    const { container } = render(
      <LineChart
        series={[
          {
            id: "a",
            label: "A",
            points: [
              { x: 1, y: 1 },
              { x: 2, y: 2, markerKind: "diamond" },
              { x: 3, y: 1 },
            ],
          },
        ]}
        markerRadius={6}
      />,
    );
    // Diamonds render as a <polygon>; circles render as <circle>. At least
    // one polygon should be present when any point requests a non-circle.
    expect(
      container.querySelector("[data-testid='line-markers'] polygon"),
    ).toBeInTheDocument();
  });

  it("surfaces a lineTooltip via useCursorTooltip on mouse move", () => {
    const { container, getByText } = render(
      <LineChart
        series={series}
        lineTooltip={{
          renderContent: (s: LineChartSeriesModel) => <span>tooltip:{s.label}</span>,
        }}
      />,
    );
    const hitTarget = container.querySelector(
      "[data-testid='line-series'] path[stroke='transparent']",
    );
    expect(hitTarget).toBeInTheDocument();
    fireEvent.mouseEnter(hitTarget!, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(hitTarget!, { clientX: 105, clientY: 100 });
    // Exactly one tooltip content node should be mounted — the implementation
    // renders a single cursor tooltip overlay, so no prefix match required.
    expect(getByText(/^tooltip:(xG|xGA)$/)).toBeInTheDocument();
  });

  it("suppresses lineTooltip when a marker is hovered (default priority)", () => {
    const { container, queryByText } = render(
      <LineChart
        series={series}
        lineTooltip={{
          renderContent: (s) => <span>cursor:{s.label}</span>,
        }}
      />,
    );
    // Hover a marker first (point tooltip opens), then hover the line —
    // the cursor tooltip should NOT render because the marker still owns.
    const marker = container.querySelector(
      "[data-testid='line-markers'] [role='button']",
    );
    expect(marker).toBeInTheDocument();
    fireEvent.mouseEnter(marker!);
    const hitTarget = container.querySelector(
      "[data-testid='line-series'] path[stroke='transparent']",
    );
    fireEvent.mouseMove(hitTarget!, { clientX: 100, clientY: 100 });
    expect(queryByText(/^cursor:/)).toBeNull();
    // The marker's own ChartTooltip is the winner.
    expect(container.querySelector("[data-testid='line-tooltip']")).toBeInTheDocument();
  });

  it("honours tooltipPriority='line' by suppressing the marker tooltip", () => {
    const { container } = render(
      <LineChart
        series={series}
        lineTooltip={{ renderContent: () => <span>cursor</span> }}
        tooltipPriority="line"
      />,
    );
    const marker = container.querySelector(
      "[data-testid='line-markers'] [role='button']",
    );
    fireEvent.mouseEnter(marker!);
    expect(container.querySelector("[data-testid='line-tooltip']")).toBeNull();
  });

  it("applies per-series strokeDasharray to only that series' line", () => {
    const { container } = render(
      <LineChart
        series={[
          { id: "actual", label: "Team", points: series[0]!.points },
          {
            id: "pace",
            label: "Pace",
            points: series[1]!.points,
            strokeDasharray: "6 4",
          },
        ]}
      />,
    );
    const paths = container.querySelectorAll(
      "[data-testid='line-series'] path[stroke]:not([stroke='transparent'])",
    );
    expect(paths.length).toBe(2);
    const dashes = Array.from(paths).map((p) => p.getAttribute("stroke-dasharray"));
    expect(dashes).toContain("6 4");
    expect(dashes.filter((d) => d === "6 4").length).toBe(1);
  });

  it("suppresses markers for a series with showMarkers=false but keeps others", () => {
    const { container } = render(
      <LineChart
        series={[
          { id: "actual", label: "Team", points: series[0]!.points },
          {
            id: "pace",
            label: "Pace",
            points: series[1]!.points,
            showMarkers: false,
          },
        ]}
      />,
    );
    const markerGroup = container.querySelector("[data-testid='line-markers']");
    expect(markerGroup).toBeInTheDocument();
    // aria-labels encode series + value; pace series should produce zero
    // marker buttons while actual still renders all four.
    const buttons = markerGroup?.querySelectorAll("[role='button']");
    const labels = Array.from(buttons ?? []).map((b) => b.getAttribute("aria-label"));
    expect(labels.some((l) => l?.startsWith("Team at"))).toBe(true);
    expect(labels.some((l) => l?.startsWith("Pace at"))).toBe(false);
  });

  it("clips envelope fills to the plot area by default, opt-out via clip:false", () => {
    // First render: no clip override → should appear under the clipped group.
    const { container, rerender } = render(
      <LineChart
        series={[
          { id: "a", label: "A", points: series[0]!.points },
          { id: "b", label: "B", points: series[1]!.points },
        ]}
        envelopes={[{ kind: "series-pair", seriesAId: "a", seriesBId: "b" }]}
      />,
    );
    const clippedGroup = container.querySelector(
      "[data-testid='line-envelopes-clipped']",
    );
    expect(clippedGroup).toBeInTheDocument();
    expect(clippedGroup?.getAttribute("clip-path")).toMatch(/^url\(#line-plot-clip-/);
    expect(
      clippedGroup?.querySelector("[data-testid='line-envelopes']"),
    ).toBeInTheDocument();

    // Second render: opt out of clipping — no wrapper group, envelopes render
    // outside any clip.
    rerender(
      <LineChart
        series={[
          { id: "a", label: "A", points: series[0]!.points },
          { id: "b", label: "B", points: series[1]!.points },
        ]}
        envelopes={[{ kind: "series-pair", seriesAId: "a", seriesBId: "b", clip: false }]}
      />,
    );
    expect(container.querySelector("[data-testid='line-envelopes-clipped']")).toBeNull();
    expect(container.querySelector("[data-testid='line-envelopes']")).toBeInTheDocument();
  });

  it("cycles through the default palette when series count exceeds it", () => {
    // 14 series, palette length is 12 — the last two wrap.
    const manySeries = Array.from({ length: 14 }, (_, i) => ({
      id: `s${i}`,
      label: `S${i}`,
      points: [
        { x: 1, y: 1 + i * 0.05 },
        { x: 2, y: 2 + i * 0.05 },
      ],
    }));
    const { container } = render(<LineChart series={manySeries} />);
    // Distinct stroke colours resolved from the palette. We don't assert the
    // exact map — only that the renderer emits stroke attributes for all
    // visible series and does not crash on wrap-around.
    const paths = container.querySelectorAll(
      "[data-testid='line-series'] path[stroke]:not([stroke='transparent'])",
    );
    expect(paths.length).toBe(14);
  });

  it("renders without axe violations (static mode)", async () => {
    const { container } = render(
      <LineChartStaticSvg series={series} trendlines={true} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
