import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartLineMark } from "../src/primitives/index.js";

afterEach(cleanup);

describe("ChartLineMark", () => {
  it("renders straight SVG line marks", () => {
    const { container } = render(
      <svg>
        <ChartLineMark
          x1={1}
          y1={2}
          x2={30}
          y2={40}
          stroke="#1d4ed8"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.7}
        />
      </svg>,
    );

    const line = container.querySelector("line");
    expect(line?.getAttribute("x1")).toBe("1");
    expect(line?.getAttribute("y2")).toBe("40");
    expect(line?.getAttribute("stroke")).toBe("#1d4ed8");
    expect(line?.getAttribute("stroke-width")).toBe("2");
    expect(line?.getAttribute("stroke-linecap")).toBe("round");
    expect(line?.getAttribute("opacity")).toBe("0.7");
  });

  it("renders path-based line marks", () => {
    const { container } = render(
      <svg>
        <ChartLineMark
          kind="path"
          d="M0,0 L10,10"
          stroke="#ef4444"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>,
    );

    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toBe("M0,0 L10,10");
    expect(path?.getAttribute("fill")).toBe("none");
    expect(path?.getAttribute("stroke")).toBe("#ef4444");
    expect(path?.getAttribute("stroke-width")).toBe("3");
    expect(path?.getAttribute("stroke-linejoin")).toBe("round");
  });
});
