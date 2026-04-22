import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { PassEvent } from "@withqwerty/campos-schema";

import { PassSonarMarker } from "../../src/primitives/PassSonarMarker";
import type { PassSonarMarkerWedgeContext } from "../../src/primitives/PassSonarMarker";

let nextId = 0;
function pass(
  dx: number,
  dy: number,
  result: PassEvent["passResult"] = "complete",
): PassEvent {
  nextId += 1;
  return {
    kind: "pass",
    id: `p-${nextId}`,
    matchId: "m",
    teamId: "t",
    playerId: "pl",
    playerName: null,
    minute: 0,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 50,
    y: 50,
    endX: 50 + dx,
    endY: 50 + dy,
    length: null,
    angle: null,
    recipient: null,
    passType: null,
    passResult: result,
    isAssist: false,
    provider: "test",
    providerEventId: `${nextId}`,
  };
}

function renderFilled(ctx: PassSonarMarkerWedgeContext) {
  if (!ctx.attemptedPath) return null;
  return (
    <path
      data-testid={`wedge-${ctx.wedge.binIndex}`}
      d={ctx.attemptedPath}
      fill="currentColor"
    />
  );
}

describe("PassSonarMarker", () => {
  it("renders one <g> per bin and skips empty bins when the render-prop returns null", () => {
    const { container } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0), pass(0, 10)]}
          x={50}
          y={50}
          radius={20}
          binCount={8}
          renderWedge={renderFilled}
        />
      </svg>,
    );
    // binCount=8 → 8 wedges total; 6 are empty and return null, 2 render a <path>.
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);
  });

  it("emits data-bin-index + data-bin-label on each wedge group", () => {
    const { container } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={50}
          y={50}
          radius={15}
          binCount={8}
          renderWedge={renderFilled}
        />
      </svg>,
    );
    const forward = container.querySelector('[data-bin-index="0"]');
    expect(forward).not.toBeNull();
    expect(forward?.getAttribute("data-bin-label")).toBe("forward");
  });

  it("calls onWedgeHover with the wedge on enter and null on leave", () => {
    const handler = vi.fn();
    const { container } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={50}
          y={50}
          radius={15}
          binCount={8}
          renderWedge={renderFilled}
          onWedgeHover={handler}
        />
      </svg>,
    );
    const forward = container.querySelector('[data-bin-index="0"]');
    fireEvent.mouseEnter(forward!);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.label).toBe("forward");
    fireEvent.mouseLeave(forward!);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1]?.[0]).toBeNull();
  });

  it("places wedges relative to the supplied (x, y)", () => {
    const { container } = render(
      <svg viewBox="0 0 200 200">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={120}
          y={80}
          radius={30}
          binCount={8}
          renderWedge={renderFilled}
        />
      </svg>,
    );
    const path = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(path.startsWith("M 120 80")).toBe(true);
    const lineMatch = /L (\S+) (\S+)/.exec(path);
    expect(lineMatch).not.toBeNull();
    const ly = Number.parseFloat(lineMatch![2] ?? "0");
    expect(ly).toBeLessThan(80);
  });

  it("renders a centre dot when one is configured and the sonar has data", () => {
    const { container } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={50}
          y={50}
          radius={20}
          binCount={8}
          centerDot={{ radius: 2, fill: "#222" }}
          renderWedge={renderFilled}
        />
      </svg>,
    );
    const dot = container.querySelector("circle");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("r")).toBe("2");
  });

  it("skips the centre dot when there are no passes", () => {
    const { container } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[]}
          x={50}
          y={50}
          radius={20}
          centerDot={{ radius: 2, fill: "#222" }}
          renderWedge={renderFilled}
        />
      </svg>,
    );
    expect(container.querySelector("circle")).toBeNull();
  });

  it("applies no SVG transform when attackingDirection defaults to 'up'", () => {
    const { container } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={50}
          y={50}
          radius={20}
          binCount={8}
          renderWedge={renderFilled}
        />
      </svg>,
    );
    const marker = container.querySelector('[data-testid="pass-sonar-marker"]');
    expect(marker?.getAttribute("transform")).toBeNull();
  });

  it("rotates 90° clockwise when attackingDirection='right'", () => {
    const { container } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={50}
          y={50}
          radius={20}
          binCount={8}
          attackingDirection="right"
          renderWedge={renderFilled}
        />
      </svg>,
    );
    const marker = container.querySelector('[data-testid="pass-sonar-marker"]');
    expect(marker?.getAttribute("transform")).toBe("rotate(90 50 50)");
  });

  it("rotates 180° when attackingDirection='down' and -90° when 'left'", () => {
    const { container: down } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={50}
          y={50}
          radius={20}
          attackingDirection="down"
          renderWedge={renderFilled}
        />
      </svg>,
    );
    expect(
      down.querySelector('[data-testid="pass-sonar-marker"]')?.getAttribute("transform"),
    ).toBe("rotate(180 50 50)");

    const { container: left } = render(
      <svg viewBox="0 0 100 100">
        <PassSonarMarker
          passes={[pass(10, 0)]}
          x={50}
          y={50}
          radius={20}
          attackingDirection="left"
          renderWedge={renderFilled}
        />
      </svg>,
    );
    expect(
      left.querySelector('[data-testid="pass-sonar-marker"]')?.getAttribute("transform"),
    ).toBe("rotate(-90 50 50)");
  });

  it("uses lengthRadius when lengthBy='mean-length'", () => {
    const passes = [pass(10, 0), pass(0, 40)];
    const { container } = render(
      <svg viewBox="0 0 200 200">
        <PassSonarMarker
          passes={passes}
          x={100}
          y={100}
          radius={60}
          binCount={8}
          lengthBy="mean-length"
          renderWedge={renderFilled}
        />
      </svg>,
    );
    const paths = [...container.querySelectorAll("path")].map(
      (p) => p.getAttribute("d") ?? "",
    );
    const radii = paths.map((d) => {
      const m = /L (\S+) (\S+)/.exec(d);
      if (!m) return 0;
      const px = Number.parseFloat(m[1] ?? "0");
      const py = Number.parseFloat(m[2] ?? "0");
      return Math.hypot(px - 100, py - 100);
    });
    expect(Math.max(...radii)).toBeGreaterThan(40);
  });
});
