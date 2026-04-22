import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartTooltip } from "../src/primitives/index.js";
import { DARK_THEME, LIGHT_THEME } from "../src/theme.js";

afterEach(cleanup);

describe("ChartTooltip", () => {
  it("renders ordered label-value rows", () => {
    render(
      <ChartTooltip
        testId="tooltip"
        rows={[
          { label: "Player", value: "Salah" },
          { label: "xG", value: "0.42" },
        ]}
        theme={LIGHT_THEME}
      />,
    );

    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toHaveTextContent("Player");
    expect(tooltip).toHaveTextContent("Salah");
    expect(tooltip).toHaveTextContent("xG");
    expect(tooltip).toHaveTextContent("0.42");
  });

  it("uses the shared tooltip chrome tokens and remains non-interactive", () => {
    render(
      <ChartTooltip
        testId="tooltip"
        rows={[{ label: "Density", value: "0.318" }]}
        theme={DARK_THEME}
      />,
    );

    expect(screen.getByTestId("tooltip")).toHaveStyle({
      background: DARK_THEME.surface.tooltip,
      border: `1px solid ${DARK_THEME.border.tooltip}`,
      borderRadius: `${DARK_THEME.radius.lg}px`,
      boxShadow: DARK_THEME.shadow.tooltip,
      color: DARK_THEME.text.primary,
      pointerEvents: "none",
    });
  });
});
