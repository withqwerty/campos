import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChartHeatmapCellLayer } from "../src/primitives/index.js";
import { DARK_THEME } from "../src/theme.js";

afterEach(cleanup);

const identityProject = (x: number, y: number) => ({ x, y });

describe("ChartHeatmapCellLayer", () => {
  it("renders projected heatmap rects", () => {
    const { container } = render(
      <svg>
        <ChartHeatmapCellLayer
          project={identityProject}
          cells={[
            {
              key: "0-0",
              x: 10,
              y: 20,
              width: 15,
              height: 10,
              fill: "#1d4ed8",
              opacity: 0.5,
            },
          ]}
        />
      </svg>,
    );

    const rect = container.querySelector("rect");
    expect(rect?.getAttribute("x")).toBe("10");
    expect(rect?.getAttribute("y")).toBe("20");
    expect(rect?.getAttribute("width")).toBe("15");
    expect(rect?.getAttribute("height")).toBe("10");
    expect(rect?.getAttribute("fill")).toBe("#1d4ed8");
    expect(rect?.getAttribute("opacity")).toBe("0.5");
  });

  it("wires hover, focus, and click handlers through the shared cell key", () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const onClick = vi.fn();

    render(
      <svg>
        <ChartHeatmapCellLayer
          project={identityProject}
          activeKey="1-2"
          onCellEnter={onEnter}
          onCellLeave={onLeave}
          onCellClick={onClick}
          cells={[
            {
              key: "1-2",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              fill: "#f97316",
              opacity: 0.6,
              interactive: true,
              role: "button",
              tabIndex: 0,
              ariaLabel: "Cell 1-2",
            },
          ]}
        />
      </svg>,
    );

    const rect = screen.getByRole("button", { name: "Cell 1-2" });
    fireEvent.mouseEnter(rect);
    fireEvent.focus(rect);
    fireEvent.mouseLeave(rect);
    fireEvent.blur(rect);
    fireEvent.click(rect);

    expect(onEnter).toHaveBeenCalledWith("1-2");
    expect(onLeave).toHaveBeenCalledWith("1-2");
    expect(onClick).toHaveBeenCalledWith("1-2");
    expect(rect.getAttribute("opacity")).toBe("0.7");
  });

  it("does not fire handlers for non-interactive cells", () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const onClick = vi.fn();

    const { container } = render(
      <svg>
        <ChartHeatmapCellLayer
          project={identityProject}
          onCellEnter={onEnter}
          onCellLeave={onLeave}
          onCellClick={onClick}
          cells={[
            {
              key: "0-0",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              fill: "#94a3b8",
              opacity: 0.2,
            },
          ]}
        />
      </svg>,
    );

    const rect = container.querySelector("rect")!;
    fireEvent.mouseEnter(rect);
    fireEvent.mouseLeave(rect);
    fireEvent.click(rect);

    expect(onEnter).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("honors explicit interactive=false even when aria props are present", () => {
    const onEnter = vi.fn();

    const { container } = render(
      <svg>
        <ChartHeatmapCellLayer
          project={identityProject}
          onCellEnter={onEnter}
          cells={[
            {
              key: "0-0",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              fill: "#94a3b8",
              opacity: 0.2,
              interactive: false,
              role: "button",
              tabIndex: 0,
              ariaLabel: "Decorative cell",
            },
          ]}
        />
      </svg>,
    );

    const rect = container.querySelector("rect")!;
    fireEvent.mouseEnter(rect);

    expect(onEnter).not.toHaveBeenCalled();
    expect(rect.getAttribute("role")).toBe("button");
  });

  it("emits theme-driven focus-visible styles for interactive cells", () => {
    const { container } = render(
      <svg>
        <ChartHeatmapCellLayer
          project={identityProject}
          theme={DARK_THEME}
          cells={[
            {
              key: "0-0",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              fill: "#2563eb",
              opacity: 0.8,
              interactive: true,
              role: "button",
              tabIndex: 0,
              ariaLabel: "Focusable cell",
            },
          ]}
        />
      </svg>,
    );

    const style = container.querySelector("style");
    expect(style?.textContent).toContain(
      `outline: ${DARK_THEME.focus.width}px solid var(--campos-focus-ring, ${DARK_THEME.focus.ring});`,
    );
    expect(style?.textContent).toContain(`outline-offset: ${DARK_THEME.focus.offset}px;`);
    expect(style?.textContent).toContain(`border-radius: ${DARK_THEME.radius.xs}px;`);
  });

  it("picks a per-cell focus ring that contrasts with the cell fill", () => {
    const { container } = render(
      <svg>
        <ChartHeatmapCellLayer
          project={identityProject}
          theme={DARK_THEME}
          cells={[
            {
              key: "light",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              fill: "#f5f5f7",
              opacity: 1,
              interactive: true,
              role: "button",
              tabIndex: 0,
              ariaLabel: "Light cell",
            },
            {
              key: "dark",
              x: 10,
              y: 0,
              width: 10,
              height: 10,
              fill: "#0f172a",
              opacity: 1,
              interactive: true,
              role: "button",
              tabIndex: 0,
              ariaLabel: "Dark cell",
            },
          ]}
        />
      </svg>,
    );

    const [lightRect, darkRect] = Array.from(container.querySelectorAll("rect"));
    expect(lightRect!.getAttribute("style")).toContain(
      `--campos-focus-ring: ${DARK_THEME.contrast.onLight}`,
    );
    expect(darkRect!.getAttribute("style")).toContain(
      `--campos-focus-ring: ${DARK_THEME.contrast.onDark}`,
    );
  });
});
