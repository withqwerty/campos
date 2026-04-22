import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartFrame } from "../src/primitives/ChartFrame";
import { LIGHT_THEME } from "../src/theme";

afterEach(cleanup);

describe("ChartFrame", () => {
  it("renders an accessible section shell", () => {
    const { getByLabelText } = render(
      <ChartFrame
        ariaLabel="Scatter plot shell"
        maxWidth={720}
        plot={<div>Plot</div>}
        theme={LIGHT_THEME}
      />,
    );

    expect(getByLabelText("Scatter plot shell")).toBeInTheDocument();
  });

  it("exposes stable frame, plot, and legend hooks", () => {
    const { container, getByLabelText } = render(
      <ChartFrame
        ariaLabel="Scatter plot shell"
        chartKind="scatter-plot"
        empty={true}
        maxWidth={720}
        plot={<div>Plot</div>}
        legend={<div>Legend</div>}
        staticMode={true}
        theme={LIGHT_THEME}
      />,
    );

    const shell = getByLabelText("Scatter plot shell");
    const plot = container.querySelector('[data-slot="plot"]');
    const legend = container.querySelector('[data-slot="legend"]');

    expect(shell).toHaveAttribute("data-slot", "frame");
    expect(shell).toHaveAttribute("data-chart-kind", "scatter-plot");
    expect(shell).toHaveAttribute("data-empty", "true");
    expect(shell).toHaveAttribute("data-static", "true");
    expect(plot).toHaveTextContent("Plot");
    expect(legend).toHaveTextContent("Legend");
  });

  it("omits the optional legend slot when it is not provided", () => {
    const { container } = render(
      <ChartFrame
        ariaLabel="Minimal shell"
        maxWidth={720}
        plot={<div>Plot</div>}
        theme={LIGHT_THEME}
      />,
    );

    expect(container.querySelector('[data-slot="legend"]')).toBeNull();
  });
});
