import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartPointMark } from "../src/primitives/index.js";

afterEach(cleanup);

describe("ChartPointMark", () => {
  it("renders supported shape variants", () => {
    const { container } = render(
      <svg>
        <ChartPointMark cx={10} cy={10} r={4} shape="circle" fill="#000000" />
        <ChartPointMark cx={30} cy={10} r={4} shape="hexagon" fill="#111111" />
        <ChartPointMark
          cx={50}
          cy={10}
          r={4}
          shape="square"
          fill="#222222"
          cornerRadius={1}
        />
        <ChartPointMark cx={70} cy={10} r={4} shape="triangle" fill="#333333" />
        <ChartPointMark cx={90} cy={10} r={4} shape="diamond" fill="#444444" />
      </svg>,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelectorAll("polygon")).toHaveLength(3);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
  });

  it("passes shared paint attributes through to the rendered mark", () => {
    const { container } = render(
      <svg>
        <ChartPointMark
          cx={12}
          cy={16}
          r={5}
          shape="circle"
          fill="#1d4ed8"
          fillOpacity={0.4}
          stroke="#0f172a"
          strokeWidth={2}
          opacity={0.8}
        />
      </svg>,
    );

    const circle = container.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("#1d4ed8");
    expect(circle?.getAttribute("fill-opacity")).toBe("0.4");
    expect(circle?.getAttribute("stroke")).toBe("#0f172a");
    expect(circle?.getAttribute("stroke-width")).toBe("2");
    expect(circle?.getAttribute("opacity")).toBe("0.8");
  });
});
