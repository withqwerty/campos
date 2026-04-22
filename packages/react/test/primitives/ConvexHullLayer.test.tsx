import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ConvexHullLayer } from "../../src/primitives/ConvexHullLayer";

const identity = (x: number, y: number) => ({ x, y });

describe("ConvexHullLayer", () => {
  it("returns null for fewer than 3 points", () => {
    const { container } = render(
      <svg>
        <ConvexHullLayer points={[{ x: 10, y: 20 }]} project={identity} />
      </svg>,
    );
    expect(container.querySelector("polygon")).toBeNull();
  });

  it("renders a polygon for 3+ points", () => {
    const points = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 50, y: 80 },
      { x: 50, y: 40 }, // interior point — should not appear in hull
    ];
    const { container } = render(
      <svg>
        <ConvexHullLayer points={points} project={identity} />
      </svg>,
    );
    const polygon = container.querySelector("polygon");
    expect(polygon).not.toBeNull();
    // Hull should have 3 vertices (the triangle), not 4
    const coords = polygon!.getAttribute("points")!.split(" ");
    expect(coords).toHaveLength(3);
  });

  it("applies fill and stroke props", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ];
    const { container } = render(
      <svg>
        <ConvexHullLayer
          points={points}
          project={identity}
          fill="red"
          stroke="blue"
          strokeWidth={2}
          opacity={0.5}
        />
      </svg>,
    );
    const polygon = container.querySelector("polygon")!;
    expect(polygon.getAttribute("fill")).toBe("red");
    expect(polygon.getAttribute("stroke")).toBe("blue");
    expect(polygon.getAttribute("stroke-width")).toBe("2");
    expect(polygon.getAttribute("opacity")).toBe("0.5");
  });
});
