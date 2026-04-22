import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScatterPlot } from "../src/index";
import { ScatterPlotStaticSvg } from "../src/ScatterPlot";

type PlayerPoint = {
  playerId: string;
  name: string;
  xg: number;
  goals: number;
  team: string;
  minutes: number;
};

const points: PlayerPoint[] = [
  {
    playerId: "salah",
    name: "Salah",
    xg: 12.5,
    goals: 18,
    team: "Liverpool",
    minutes: 2600,
  },
  {
    playerId: "saka",
    name: "Saka",
    xg: 8.2,
    goals: 14,
    team: "Arsenal",
    minutes: 2800,
  },
];

afterEach(cleanup);

describe("<ScatterPlot />", () => {
  it("renders a scatter plot shell with marker styling", () => {
    render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
        markers={{
          fill: {
            by: ({ point }) => point?.team,
            values: {
              Liverpool: "#d97706",
              Arsenal: "#dc2626",
            },
          },
          radius: ({ point }) =>
            point?.minutes != null && point.minutes >= 2700 ? 9 : 6,
        }}
      />,
    );

    const shell = screen.getByLabelText("Scatter plot: 2 points, xG vs Goals");

    expect(shell).toBeInTheDocument();
    expect(shell).toHaveAttribute("data-chart-kind", "scatter-plot");
    expect(shell).toHaveAttribute("data-slot", "frame");
  });

  it("renders the empty state when there are no plottable points", () => {
    render(<ScatterPlot points={[]} xKey="xg" yKey="goals" xLabel="xG" yLabel="Goals" />);

    const emptyState = screen.getByText("No plottable data");
    const shell = emptyState.closest('[data-slot="frame"]');

    expect(emptyState).toBeInTheDocument();
    expect(shell).toHaveAttribute("data-empty", "true");
    expect(emptyState.closest('[data-slot="empty-state"]')).not.toBeNull();
  });

  it("shows tooltip content when a point is focused", () => {
    render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
      />,
    );

    const markers = screen.getAllByRole("button", { name: /Salah:/ });
    const marker = markers[0] as HTMLElement;
    fireEvent.focus(marker);

    expect(screen.getByText("Salah")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByTestId("scatterplot-tooltip")).toHaveAttribute(
      "data-slot",
      "tooltip",
    );
  });

  it("marks the shell as static when staticMode is enabled", () => {
    render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        staticMode={true}
      />,
    );

    expect(
      document.querySelector('[data-slot="frame"][data-chart-kind="scatter-plot"]'),
    ).toHaveAttribute("data-static", "true");
  });

  it("renders visible labels, guide labels, and region labels when configured", () => {
    render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
        labelIds={["salah"]}
        guides={[{ axis: "x", value: 10, label: "Median xG" }]}
        regions={[
          {
            x1: 0,
            x2: 10,
            y1: 0,
            y2: 20,
            fill: "#fef3c7",
            label: "Left side",
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Salah").length).toBeGreaterThan(0);
    expect(screen.getByText("Median xG")).toBeInTheDocument();
    expect(screen.getByText("Left side")).toBeInTheDocument();
  });

  it("can auto-label extremes without manual ids", () => {
    render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
        labelStrategy="extremes"
        autoLabelCount={2}
      />,
    );

    expect(screen.getAllByText("Salah").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saka").length).toBeGreaterThan(0);
  });

  it("keeps focused tooltip content stable across point reordering when idKey is provided", () => {
    const { rerender } = render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
      />,
    );

    fireEvent.focus(screen.getAllByRole("button", { name: /Salah:/ })[0] as HTMLElement);
    expect(screen.getAllByText("Salah").length).toBeGreaterThan(0);

    rerender(
      <ScatterPlot
        points={[points[1] as PlayerPoint, points[0] as PlayerPoint]}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
      />,
    );

    expect(screen.getAllByText("Salah").length).toBeGreaterThan(0);
  });

  it("renders methodology notes around the plot and legend", () => {
    render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        methodologyNotes={{
          above: "Compared across all competitions",
          between: "Minimum 900 minutes played",
          below: "Data as of matchweek 32",
        }}
      />,
    );

    const above = screen.getByTestId("chart-note-above");
    const between = screen.getByTestId("chart-note-between");
    const below = screen.getByTestId("chart-note-below");

    expect(above).toHaveTextContent("Compared across all competitions");
    expect(between).toHaveTextContent("Minimum 900 minutes played");
    expect(below).toHaveTextContent("Data as of matchweek 32");
  });

  it("renders the static SVG path with deterministic labels and style families", () => {
    const { container } = render(
      <ScatterPlotStaticSvg
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
        labelIds={["salah"]}
        guides={[{ axis: "x", value: 10, label: "Median xG" }]}
        regions={[
          {
            x1: 0,
            x2: 10,
            y1: 0,
            y2: 20,
            fill: "#fef3c7",
            label: "Left side",
          },
        ]}
        guideStyle={{ stroke: "#0f766e", labelColor: "#14532d" }}
        regionStyle={{ fill: "#dcfce7", labelColor: "#166534" }}
        labelStyle={{ fill: "#1f2937", connectorStroke: "#94a3b8" }}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg?.getAttribute("aria-label")).toMatch(/Scatter plot/i);
    const textNodes = Array.from(svg?.querySelectorAll("text") ?? []);
    const medianGuide = textNodes.find((node) => node.textContent === "Median xG");
    const regionLabel = textNodes.find((node) => node.textContent === "Left side");
    const salahLabel = textNodes.find((node) => node.textContent === "Salah");

    expect(medianGuide).toHaveAttribute("fill", "#14532d");
    expect(regionLabel).toHaveAttribute("fill", "#166534");
    expect(salahLabel).toHaveAttribute("fill", "#1f2937");
  });

  it("applies constant, map, and callback marker styles", () => {
    render(
      <ScatterPlot
        points={points}
        idKey="playerId"
        xKey="xg"
        yKey="goals"
        xLabel="xG"
        yLabel="Goals"
        labelKey="name"
        markers={{
          fill: {
            by: ({ point }) => point?.team,
            values: {
              Liverpool: "#f59e0b",
              Arsenal: "#ef4444",
            },
            fallback: "#94a3b8",
          },
          radius: ({ point }) =>
            point?.minutes != null && point.minutes >= 2700 ? 10 : 6,
          shape: ({ point }) => (point?.team === "Liverpool" ? "square" : "circle"),
          stroke: "#0f172a",
          strokeWidth: 1.5,
        }}
      />,
    );

    const salahMarker = screen.getAllByRole("button", { name: /Salah:/ }).at(-1)!;
    const salahVisibleRect = Array.from(salahMarker.querySelectorAll("rect")).find(
      (rect) => rect.getAttribute("fill") === "#f59e0b",
    );
    expect(salahVisibleRect).toBeTruthy();
    expect(salahVisibleRect?.getAttribute("stroke")).toBe("#0f172a");

    const sakaMarker = screen.getAllByRole("button", { name: /Saka:/ }).at(-1)!;
    const sakaVisibleCircle = Array.from(sakaMarker.querySelectorAll("circle")).find(
      (circle) => circle.getAttribute("fill") === "#ef4444",
    );
    expect(sakaVisibleCircle).toBeTruthy();
    expect(sakaVisibleCircle?.getAttribute("r")).toBe("10");
  });

  it("respects staticMode on the public component — no interactive handlers", () => {
    cleanup();
    const { container } = render(
      <ScatterPlot
        points={points}
        xKey="xg"
        yKey="goals"
        labelKey="name"
        xLabel="xG"
        yLabel="Goals"
        staticMode
      />,
    );

    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-label")).toMatch(/Scatter plot/);
    const buttons = container.querySelectorAll('[role="button"]');
    expect(buttons).toHaveLength(0);
  });
});
