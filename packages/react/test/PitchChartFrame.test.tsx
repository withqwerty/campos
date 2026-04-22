import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PitchChartFrame } from "../src/primitives/PitchChartFrame";
import { LIGHT_THEME } from "../src/theme";

afterEach(cleanup);

describe("PitchChartFrame", () => {
  it("renders an accessible section shell", () => {
    const { getByLabelText } = render(
      <PitchChartFrame
        ariaLabel="Shot map shell"
        chartKind="shot-map"
        maxWidth={420}
        empty={true}
        plot={<div>Plot</div>}
        staticMode={true}
        theme={LIGHT_THEME}
      />,
    );

    const shell = getByLabelText("Shot map shell");

    expect(shell).toBeInTheDocument();
    expect(shell).toHaveAttribute("data-slot", "frame");
    expect(shell).toHaveAttribute("data-chart-kind", "shot-map");
    expect(shell).toHaveAttribute("data-empty", "true");
    expect(shell).toHaveAttribute("data-static", "true");
  });

  it("preserves pre-plot, plot, and post-plot ordering", () => {
    const { getByTestId } = render(
      <PitchChartFrame
        ariaLabel="Ordered shell"
        maxWidth={420}
        prePlot={<div>Header</div>}
        plot={<div>Plot</div>}
        postPlot={<div>Legend</div>}
        theme={LIGHT_THEME}
      />,
    );

    expect(getByTestId("pitch-chart-pre-plot").textContent).toBe("Header");
    expect(getByTestId("pitch-chart-pre-plot")).toHaveAttribute("data-slot", "pre-plot");
    expect(getByTestId("pitch-chart-plot").textContent).toBe("Plot");
    expect(getByTestId("pitch-chart-plot")).toHaveAttribute("data-slot", "plot");
    expect(getByTestId("pitch-chart-post-plot").textContent).toBe("Legend");
    expect(getByTestId("pitch-chart-post-plot")).toHaveAttribute(
      "data-slot",
      "post-plot",
    );
  });

  it("omits optional slots when they are not provided", () => {
    const { queryByTestId } = render(
      <PitchChartFrame
        ariaLabel="Minimal shell"
        maxWidth={420}
        plot={<div>Plot</div>}
        theme={LIGHT_THEME}
      />,
    );

    expect(queryByTestId("pitch-chart-pre-plot")).toBeNull();
    expect(queryByTestId("pitch-chart-post-plot")).toBeNull();
  });
});
