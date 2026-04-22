import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ChartGradientLegend,
  ChartLegend,
  ChartScaleBar,
  ChartSizeLegend,
} from "../src/primitives/index.js";
import { DARK_THEME, LIGHT_THEME } from "../src/theme.js";

afterEach(cleanup);

describe("legend primitives", () => {
  it("renders a categorical legend title and items", () => {
    const { container } = render(
      <ChartLegend
        title="Outcome"
        testId="legend"
        items={[
          { key: "goal", label: "Goal", color: "#1d4ed8" },
          { key: "saved", label: "Saved", color: "#6b7280" },
        ]}
        theme={LIGHT_THEME}
      />,
    );

    expect(screen.getByTestId("legend")).toHaveTextContent("Outcome");
    expect(screen.getByTestId("legend")).toHaveTextContent("Goal");
    expect(screen.getByTestId("legend")).toHaveTextContent("Saved");

    const swatches = container.querySelectorAll("span[style]");
    expect(
      Array.from(swatches).some((node) =>
        node.getAttribute("style")?.includes("background: rgb(29, 78, 216)"),
      ),
    ).toBe(true);
  });

  it("renders circular categorical swatches when requested", () => {
    const { container } = render(
      <ChartLegend
        title="Team"
        items={[{ key: "ars", label: "Arsenal", color: "#ef4444" }]}
        swatchShape="circle"
        theme={LIGHT_THEME}
      />,
    );

    expect(container.innerHTML).toContain("border-radius: 50%");
  });

  it("renders a gradient legend with endpoint labels", () => {
    const { container } = render(
      <ChartGradientLegend
        title="xT"
        startLabel="Low"
        endLabel="High"
        colors={["#f8fafc", "#60a5fa", "#1d4ed8"]}
        theme={DARK_THEME}
      />,
    );

    expect(screen.getByText("xT")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(container.innerHTML).toContain(
      "linear-gradient(90deg, #f8fafc, #60a5fa, #1d4ed8)",
    );
  });

  it("renders interior tick labels when ticks prop is supplied", () => {
    render(
      <ChartGradientLegend
        title="xP delta"
        startLabel="-4%"
        endLabel="+4%"
        colors={["#d94747", "#f2f2f2", "#4fa34f"]}
        ticks={[{ at: 0.5, label: "0" }]}
        theme={LIGHT_THEME}
      />,
    );

    expect(screen.getByText("-4%")).toBeInTheDocument();
    expect(screen.getByText("+4%")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("honours width override on the gradient bar", () => {
    const { container } = render(
      <ChartGradientLegend
        title="Metric"
        startLabel="0"
        endLabel="100"
        colors={["#fff", "#000"]}
        width={200}
        theme={LIGHT_THEME}
      />,
    );
    const bar = container.querySelector("div[style*='width: 200px']");
    expect(bar).toBeTruthy();
  });

  it("clamps out-of-range ticks to [0,1] (with a dev-only warning)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <ChartGradientLegend
        title="Metric"
        startLabel="-1"
        endLabel="+1"
        colors={["#d94747", "#f2f2f2", "#4fa34f"]}
        ticks={[
          { at: 1.5, label: "high" },
          { at: -0.2, label: "low" },
        ]}
        theme={LIGHT_THEME}
      />,
    );

    // Both labels render, and both clamp to an edge position.
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("low")).toBeInTheDocument();
    const highPos = container.querySelector("div[style*='left: 100%']");
    const lowPos = container.querySelector("div[style*='left: 0%']");
    expect(highPos).toBeTruthy();
    expect(lowPos).toBeTruthy();

    // Dev-only warn fires once per out-of-range tick.
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("does not render tick DOM when ticks is empty or undefined", () => {
    const { container } = render(
      <ChartGradientLegend
        title="Metric"
        startLabel="0"
        endLabel="1"
        colors={["#000", "#fff"]}
        theme={LIGHT_THEME}
      />,
    );
    // Without ticks, the legend should only render bar + labels — no
    // extra inner flex container for the tick row.
    expect(container.querySelectorAll("div").length).toBeLessThan(6);
  });

  it("renders a size legend with one bubble per item", () => {
    const { container } = render(
      <ChartSizeLegend
        title="Touches"
        items={[
          { key: "small", label: "10", radius: 4 },
          { key: "large", label: "50", radius: 8 },
        ]}
        theme={LIGHT_THEME}
      />,
    );

    expect(screen.getByText("Touches")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  it("renders a scale bar label, range labels, and ordered color stops", () => {
    const { container } = render(
      <ChartScaleBar
        label="xG"
        startLabel="0.0"
        endLabel="1.0"
        stops={[
          { offset: 0, color: "#f8fafc" },
          { offset: 0.5, color: "#60a5fa" },
          { offset: 1, color: "#1d4ed8" },
        ]}
        testId="scale-bar"
        theme={LIGHT_THEME}
      />,
    );

    expect(screen.getByTestId("scale-bar")).toHaveTextContent("xG");
    expect(screen.getByTestId("scale-bar")).toHaveTextContent("0.0");
    expect(screen.getByTestId("scale-bar")).toHaveTextContent("1.0");
    expect(container.innerHTML).toContain(
      "linear-gradient(90deg, #f8fafc 0%, #60a5fa 50%, #1d4ed8 100%)",
    );
  });
});
