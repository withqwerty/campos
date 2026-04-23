import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Pitch } from "../../src/react/Pitch.js";

describe("<Pitch>", () => {
  it("renders an SVG element with overflow hidden", () => {
    const { container } = render(<Pitch crop="full">{() => null}</Pitch>);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("overflow")).toBe("hidden");
  });

  it("full pitch has a viewBox matching pitch dimensions", () => {
    const { container } = render(<Pitch crop="full">{() => null}</Pitch>);
    const svg = container.querySelector("svg");
    const vb = svg?.getAttribute("viewBox");
    expect(vb).toContain("68");
    expect(vb).toContain("105");
  });

  it("half pitch has half the height", () => {
    const { container } = render(<Pitch crop="half">{() => null}</Pitch>);
    const svg = container.querySelector("svg");
    const vb = svg?.getAttribute("viewBox");
    expect(vb).toContain("52.5");
  });

  it("uses the crop aspect ratio by default", () => {
    const { container } = render(<Pitch crop="half">{() => null}</Pitch>);
    const svg = container.querySelector("svg");
    expect(svg?.style.aspectRatio).toBe("68 / 52.5");
  });

  it("uses a full-pitch frame when requested", () => {
    const { container } = render(
      <Pitch crop="penalty-area" attackingDirection="right" frame="full">
        {() => null}
      </Pitch>,
    );
    const [outerSvg, innerSvg] = Array.from(container.querySelectorAll("svg"));
    expect(outerSvg?.style.aspectRatio).toBe("105 / 68");
    expect(outerSvg?.getAttribute("viewBox")).toBe("0 0 105 68");
    expect(innerSvg?.getAttribute("viewBox")).toContain("23.15");
  });

  it("anchors defend crops to the bottom or right side of the frame", () => {
    const { container } = render(
      <Pitch crop="half" side="defend" frame="full">
        {() => null}
      </Pitch>,
    );
    const [, innerSvg] = Array.from(container.querySelectorAll("svg"));
    expect(innerSvg?.getAttribute("y")).toBe("52.5");
  });

  it("places the inner svg at the absolute user-space origin of the crop (horizontal half attack)", () => {
    // The inner svg must be placed at the absolute crop origin (x=52.5),
    // not at a delta from frameViewBox.minX — otherwise it falls outside
    // the outer viewBox and is clipped by overflow="hidden".
    const { container } = render(
      <Pitch crop="half" attackingDirection="right">
        {() => null}
      </Pitch>,
    );
    const [outerSvg, innerSvg] = Array.from(container.querySelectorAll("svg"));
    // Half-pitch viewBox spans the attacking half: x-origin 52.5, width 52.5,
    // y-origin 0, height 68. Exact string match on the whole viewBox is fine
    // because these four values together identify the crop; but parse the
    // inner svg attributes numerically so float drift doesn't produce a
    // rare mismatch if Pitch later rounds to more decimal places.
    expect(outerSvg?.getAttribute("viewBox")).toBe("52.5 0 52.5 68");
    expect(Number(innerSvg?.getAttribute("x"))).toBeCloseTo(52.5, 3);
    expect(Number(innerSvg?.getAttribute("y"))).toBe(0);
    expect(Number(innerSvg?.getAttribute("width"))).toBeCloseTo(52.5, 3);
    expect(Number(innerSvg?.getAttribute("height"))).toBe(68);
  });

  it("places the inner svg at the absolute crop origin for vertical half attack", () => {
    const { container } = render(
      <Pitch crop="half" attackingDirection="up">
        {() => null}
      </Pitch>,
    );
    const [outerSvg, innerSvg] = Array.from(container.querySelectorAll("svg"));
    // Vertical attack is the top half of the pitch.
    expect(outerSvg?.getAttribute("viewBox")).toBe("0 0 68 52.5");
    expect(innerSvg?.getAttribute("x")).toBe("0");
    expect(innerSvg?.getAttribute("y")).toBe("0");
  });

  it("places the inner svg at the absolute crop origin for vertical half defend", () => {
    const { container } = render(
      <Pitch crop="half" attackingDirection="up" side="defend">
        {() => null}
      </Pitch>,
    );
    const [outerSvg, innerSvg] = Array.from(container.querySelectorAll("svg"));
    expect(outerSvg?.getAttribute("viewBox")).toBe("0 52.5 68 52.5");
    expect(innerSvg?.getAttribute("x")).toBe("0");
    expect(innerSvg?.getAttribute("y")).toBe("52.5");
  });

  it("provides a working project function to children", () => {
    let projectedPoint: { x: number; y: number } | null = null;
    render(
      <Pitch crop="full">
        {({ project }) => {
          projectedPoint = project(50, 50);
          return null;
        }}
      </Pitch>,
    );
    expect(projectedPoint).not.toBeNull();
    const pt = projectedPoint as unknown as { x: number; y: number };
    expect(pt.x).toBeGreaterThan(0);
    expect(pt.y).toBeGreaterThan(0);
  });

  it("renders pitch markings (rects for boundary and areas)", () => {
    const { container } = render(<Pitch crop="full">{() => null}</Pitch>);
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });

  it("renders children SVG elements on top of pitch", () => {
    const { container } = render(
      <Pitch crop="full">
        {({ project }) => {
          const p = project(50, 50);
          return <circle data-testid="child" cx={p.x} cy={p.y} r={2} />;
        }}
      </Pitch>,
    );
    expect(container.querySelector("[data-testid='child']")).not.toBeNull();
  });

  it("applies dark theme colors by default", () => {
    const { container } = render(<Pitch crop="full">{() => null}</Pitch>);
    const bg = container.querySelector("rect");
    expect(bg?.getAttribute("fill")).toBe("#1a472a");
  });

  it("applies light theme when specified", () => {
    const { container } = render(
      <Pitch crop="full" theme="secondary">
        {() => null}
      </Pitch>,
    );
    const bg = container.querySelector("rect");
    expect(bg?.getAttribute("fill")).toBe("#12141a");
  });

  it("color overrides take precedence", () => {
    const { container } = render(
      <Pitch crop="full" colors={{ fill: "#1a472a" }}>
        {() => null}
      </Pitch>,
    );
    const bg = container.querySelector("rect");
    expect(bg?.getAttribute("fill")).toBe("#1a472a");
  });

  it("renders tactical markings when enabled", () => {
    const { container } = render(
      <Pitch crop="full" markings={{ halfSpaces: true }}>
        {() => null}
      </Pitch>,
    );
    const dashedLines = container.querySelectorAll("line[stroke-dasharray]");
    expect(dashedLines.length).toBeGreaterThan(0);
  });

  it("interactive={false} sets pointerEvents none on SVG", () => {
    const { container } = render(
      <Pitch crop="full" interactive={false}>
        {() => null}
      </Pitch>,
    );
    const svg = container.querySelector("svg");
    expect(svg?.style.pointerEvents).toBe("none");
  });

  describe("grass patterns", () => {
    it("renders no pattern elements when grass is undefined", () => {
      const { container } = render(<Pitch crop="full">{() => null}</Pitch>);
      expect(container.querySelector("[data-stadia='grass-pattern']")).toBeNull();
      expect(container.querySelector("defs")).toBeNull();
    });

    it("stripes: renders a <defs> with <pattern> and an overlay rect", () => {
      const { container } = render(
        <Pitch crop="full" grass={{ type: "stripes" }}>
          {() => null}
        </Pitch>,
      );
      const grassGroup = container.querySelector("[data-stadia='grass-pattern']");
      expect(grassGroup).not.toBeNull();
      const pattern = container.querySelector("pattern");
      expect(pattern).not.toBeNull();
      expect(pattern?.getAttribute("patternUnits")).toBe("userSpaceOnUse");
      expect(pattern?.id).toBe("stadia-grass-stripes");
    });

    it("diagonal: renders a pattern with patternTransform rotate", () => {
      const { container } = render(
        <Pitch crop="full" grass={{ type: "diagonal", angle: 30 }}>
          {() => null}
        </Pitch>,
      );
      const pattern = container.querySelector("pattern");
      expect(pattern?.getAttribute("patternTransform")).toBe("rotate(30)");
    });

    it("chevron: renders a pattern with path elements", () => {
      const { container } = render(
        <Pitch crop="full" grass={{ type: "chevron" }}>
          {() => null}
        </Pitch>,
      );
      const pattern = container.querySelector("pattern");
      expect(pattern).not.toBeNull();
      const paths = pattern?.querySelectorAll("path");
      expect(paths?.length).toBeGreaterThanOrEqual(2);
    });

    it("checkerboard: renders a 4-rect pattern tile", () => {
      const { container } = render(
        <Pitch crop="full" grass={{ type: "checkerboard" }}>
          {() => null}
        </Pitch>,
      );
      const pattern = container.querySelector("pattern");
      expect(pattern).not.toBeNull();
      const rects = pattern?.querySelectorAll("rect");
      expect(rects?.length).toBe(4);
    });

    it("concentric: renders circle elements, not a pattern", () => {
      const { container } = render(
        <Pitch crop="full" grass={{ type: "concentric" }}>
          {() => null}
        </Pitch>,
      );
      const grassGroup = container.querySelector("[data-stadia='grass-pattern']");
      expect(grassGroup).not.toBeNull();
      expect(container.querySelector("pattern")).toBeNull();
      const circles = grassGroup?.querySelectorAll("circle");
      expect(circles!.length).toBeGreaterThan(0);
    });

    it("formula: renders a grid of rect elements", () => {
      const { container } = render(
        <Pitch
          crop="full"
          grass={{ type: "formula", fn: (x, y) => (x + y > 50 ? 1 : 0) }}
        >
          {() => null}
        </Pitch>,
      );
      const grassGroup = container.querySelector("[data-stadia='grass-pattern']");
      expect(grassGroup).not.toBeNull();
      const rects = grassGroup?.querySelectorAll("rect");
      expect(rects!.length).toBeGreaterThan(10);
    });

    it("custom: calls render function and uses the provided id", () => {
      const { container } = render(
        <Pitch
          crop="full"
          grass={{
            type: "custom",
            id: "my-custom",
            render: () => ({
              patternUnits: "userSpaceOnUse",
              width: 10,
              height: 10,
              children: <rect width={5} height={10} fill="red" />,
            }),
          }}
        >
          {() => null}
        </Pitch>,
      );
      const pattern = container.querySelector("pattern#my-custom");
      expect(pattern).not.toBeNull();
    });

    it("works with half crop", () => {
      const { container } = render(
        <Pitch crop="half" grass={{ type: "stripes" }}>
          {() => null}
        </Pitch>,
      );
      expect(container.querySelector("[data-stadia='grass-pattern']")).not.toBeNull();
    });

    it("works with horizontal orientation", () => {
      const { container } = render(
        <Pitch crop="full" attackingDirection="right" grass={{ type: "stripes" }}>
          {() => null}
        </Pitch>,
      );
      expect(container.querySelector("[data-stadia='grass-pattern']")).not.toBeNull();
    });

    it("respects opacity < 1 by wrapping in a group", () => {
      const { container } = render(
        <Pitch crop="full" grass={{ type: "stripes", opacity: 0.5 }}>
          {() => null}
        </Pitch>,
      );
      const opacityGroup = container.querySelector("g[opacity='0.5']");
      expect(opacityGroup).not.toBeNull();
    });
  });
});
