import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import type { ComputePassMapInput } from "../src/compute/index.js";

import { PassMap, ThemeProvider, DARK_THEME } from "../src/index";

afterEach(cleanup);

const passes: ComputePassMapInput["passes"] = [
  {
    kind: "pass" as const,
    id: "1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p1",
    playerName: "Ødegaard",
    minute: 4,
    addedMinute: null,
    second: 12,
    period: 1,
    x: 55.3,
    y: 38.2,
    endX: 72.1,
    endY: 45.6,
    length: 18.3,
    angle: 0.42,
    recipient: "Saka",
    passResult: "complete",
    passType: "ground",
    isAssist: false,
    provider: "whoscored",
    providerEventId: "100",
    sourceMeta: {},
  },
  {
    kind: "pass" as const,
    id: "2",
    matchId: "m1",
    teamId: "t1",
    playerId: "p2",
    playerName: "Rice",
    minute: 12,
    addedMinute: null,
    second: 44,
    period: 1,
    x: 40.0,
    y: 52.0,
    endX: 28.0,
    endY: 60.0,
    length: 14.6,
    angle: -2.51,
    recipient: null,
    passResult: "incomplete",
    passType: "high",
    isAssist: false,
    provider: "whoscored",
    providerEventId: "200",
    sourceMeta: {},
  },
  {
    kind: "pass" as const,
    id: "3",
    matchId: "m1",
    teamId: "t1",
    playerId: "p3",
    playerName: "Saka",
    minute: 25,
    addedMinute: null,
    second: 10,
    period: 1,
    x: 82.0,
    y: 88.0,
    endX: 92.0,
    endY: 50.0,
    length: 39.3,
    angle: -1.32,
    recipient: "Havertz",
    passResult: "complete",
    passType: "cross",
    isAssist: true,
    provider: "whoscored",
    providerEventId: "300",
    sourceMeta: {},
  },
];

const dotPass: ComputePassMapInput["passes"] = [
  {
    kind: "pass" as const,
    id: "dot-1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p1",
    playerName: "Saliba",
    minute: 30,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 20.0,
    y: 50.0,
    endX: null,
    endY: null,
    length: null,
    angle: null,
    recipient: null,
    passResult: "complete",
    passType: "ground",
    isAssist: false,
    provider: "whoscored",
    providerEventId: "400",
    sourceMeta: {},
  },
];

// ─── Rendering ──────────────────────────────────────────────────────

describe("<PassMap /> — rendering", () => {
  it("renders the zero-config shell with stats and legend", () => {
    const { getByLabelText, getByText } = render(<PassMap passes={passes} />);

    expect(getByLabelText(/Pass map: 3 passes/)).toBeInTheDocument();
    expect(getByText("Passes")).toBeInTheDocument();
    expect(getByText("3")).toBeInTheDocument();
    expect(getByText("Complete")).toBeInTheDocument();
    expect(getByText("Incomplete")).toBeInTheDocument();
  });

  it("can hide header stats and legend for compact-grid usage", () => {
    const { queryByText } = render(
      <PassMap passes={passes} showHeaderStats={false} showLegend={false} />,
    );

    expect(queryByText("Passes")).not.toBeInTheDocument();
    expect(queryByText("Complete")).not.toBeInTheDocument();
    expect(queryByText("Incomplete")).not.toBeInTheDocument();
  });

  it("renders the empty state when there are no passes", () => {
    const { getByText, queryByTestId } = render(<PassMap passes={[]} />);

    expect(getByText("No pass data")).toBeInTheDocument();
    expect(queryByTestId("passmap-tooltip")).not.toBeInTheDocument();
  });

  it("renders one marker per plottable pass", () => {
    const { container } = render(<PassMap passes={passes} />);

    const markers = within(container).getAllByRole("button");
    expect(markers).toHaveLength(3);
  });

  it("renders a dot for passes with missing endX/endY", () => {
    const { container } = render(<PassMap passes={dotPass} />);

    const markers = within(container).getAllByRole("button");
    expect(markers).toHaveLength(1);
    // Dot pass renders a circle, not lines
    const circle = markers[0]!.querySelector("circle");
    expect(circle).not.toBeNull();
    const line = markers[0]!.querySelector("line");
    expect(line).toBeNull();
  });

  it("renders arrows with invisible hit area for normal passes", () => {
    const { container } = render(<PassMap passes={passes} />);

    const markers = within(container).getAllByRole("button");
    const lines = markers[0]!.querySelectorAll("line");
    expect(lines.length).toBe(2);
    expect(lines[0]!.getAttribute("stroke")).toBe("transparent");
  });

  it("supports constant line and dot styling", () => {
    const { container } = render(
      <PassMap
        passes={[...passes, ...dotPass]}
        lines={{
          stroke: "#ff0000",
          strokeWidth: 1.2,
          strokeDasharray: "3 2",
        }}
        dots={{
          fill: "#123456",
          radius: 2.2,
        }}
      />,
    );

    const visibleLine = Array.from(
      container.querySelectorAll('g[role="button"] line'),
    ).find((line) => line.getAttribute("stroke") === "#ff0000");
    expect(visibleLine).not.toBeNull();
    expect(visibleLine).toHaveAttribute("stroke-width", "1.2");
    expect(visibleLine).toHaveAttribute("stroke-dasharray", "3 2");

    const dot = Array.from(container.querySelectorAll('g[role="button"] circle')).find(
      (circle) => circle.getAttribute("fill") === "#123456",
    );
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("r", "2.2");
  });

  it("supports object-map line and dot styling", () => {
    const { container } = render(
      <PassMap
        passes={[...passes, ...dotPass]}
        lines={{
          stroke: {
            by: ({ pass }) => pass.passType ?? "unknown",
            values: {
              ground: "#2563eb",
              high: "#7c3aed",
              cross: "#dc2626",
            },
            fallback: "#64748b",
          },
          strokeDasharray: {
            by: ({ pass }) => pass.passResult ?? "unknown",
            values: {
              incomplete: "2 2",
            },
          },
        }}
        dots={{
          fill: {
            by: ({ pass }) => pass.recipient ?? "unknown",
            values: {
              unknown: "#123456",
            },
          },
        }}
      />,
    );

    const visibleLines = Array.from(
      container.querySelectorAll('g[role="button"] line'),
    ).filter((line) => line.getAttribute("stroke") !== "transparent");
    expect(visibleLines.some((line) => line.getAttribute("stroke") === "#2563eb")).toBe(
      true,
    );
    expect(visibleLines.some((line) => line.getAttribute("stroke") === "#7c3aed")).toBe(
      true,
    );
    expect(visibleLines.some((line) => line.getAttribute("stroke") === "#dc2626")).toBe(
      true,
    );
    expect(
      visibleLines.some((line) => line.getAttribute("stroke-dasharray") === "2 2"),
    ).toBe(true);

    const dot = Array.from(container.querySelectorAll('g[role="button"] circle')).find(
      (circle) => circle.getAttribute("fill") === "#123456",
    );
    expect(dot).not.toBeNull();
  });

  it("supports callback-driven line and dot styling", () => {
    const { container } = render(
      <PassMap
        passes={[...passes, ...dotPass]}
        lines={{
          stroke: ({ pass }) => (pass.recipient === "Saka" ? "#ff0000" : "#0000ff"),
          strokeDasharray: ({ pass }) =>
            pass.passResult === "incomplete" ? "2 2" : undefined,
        }}
        dots={{
          fill: ({ pass }) => (pass.id === "dot-1" ? "#123456" : undefined),
          radius: ({ pass }) => (pass.id === "dot-1" ? 2.4 : undefined),
        }}
      />,
    );

    const visibleLines = Array.from(
      container.querySelectorAll('g[role="button"] line'),
    ).filter((line) => line.getAttribute("stroke") !== "transparent");
    expect(visibleLines.some((line) => line.getAttribute("stroke") === "#ff0000")).toBe(
      true,
    );
    expect(visibleLines.some((line) => line.getAttribute("stroke") === "#0000ff")).toBe(
      true,
    );
    expect(
      visibleLines.some((line) => line.getAttribute("stroke-dasharray") === "2 2"),
    ).toBe(true);

    const dot = Array.from(container.querySelectorAll('g[role="button"] circle')).find(
      (circle) => circle.getAttribute("fill") === "#123456",
    );
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("r", "2.4");
  });

  it("exposes sharedScale to callback-driven line styling", () => {
    const { container } = render(
      <PassMap
        passes={passes}
        sharedScale={{ widthDomain: [10, 40] }}
        lines={{
          strokeWidth: ({ sharedScale }) =>
            sharedScale?.widthDomain?.[1] === 40 ? 1.4 : 0.5,
        }}
      />,
    );

    const visibleLine = Array.from(
      container.querySelectorAll('g[role="button"] line'),
    ).find((line) => line.getAttribute("stroke") !== "transparent");
    expect(visibleLine).not.toBeNull();
    expect(visibleLine).toHaveAttribute("stroke-width", "1.4");
  });
});

// ─── Interaction ────────────────────────────────────────────────────

describe("<PassMap /> — interaction", () => {
  it("shows tooltip content when a marker is focused", () => {
    const { getAllByRole, getByText, getByTestId } = render(<PassMap passes={passes} />);

    const marker = getAllByRole("button", {
      name: /Player: Ødegaard/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);

    expect(getByText("Ødegaard")).toBeInTheDocument();
    expect(getByText("Saka")).toBeInTheDocument();
    expect(getByText("4'")).toBeInTheDocument();
    expect(getByTestId("passmap-tooltip")).toBeInTheDocument();
  });

  it("shows assist row in tooltip for assist passes", () => {
    const { getAllByRole, getByText } = render(<PassMap passes={passes} />);

    const marker = getAllByRole("button", {
      name: /Player: Saka/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);

    expect(getByText("Yes")).toBeInTheDocument();
    expect(getByText("Assist")).toBeInTheDocument();
  });

  it("dismisses tooltip on blur", () => {
    const { getAllByRole, getByTestId, queryByTestId } = render(
      <PassMap passes={passes} />,
    );

    const marker = getAllByRole("button", {
      name: /Player: Ødegaard/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);
    expect(getByTestId("passmap-tooltip")).toBeInTheDocument();

    fireEvent.blur(marker);
    expect(queryByTestId("passmap-tooltip")).not.toBeInTheDocument();
  });

  it("keeps the hover tooltip non-interactive", () => {
    const { getAllByRole, getByTestId } = render(<PassMap passes={passes} />);

    const marker = getAllByRole("button", {
      name: /Player: Ødegaard/,
    })[0] as HTMLElement;
    fireEvent.mouseEnter(marker);

    expect(getByTestId("passmap-tooltip")).toHaveStyle({
      pointerEvents: "none",
    });
  });

  it("toggles tooltip on click (tap-friendly)", () => {
    const { getAllByRole, getByTestId, queryByTestId } = render(
      <PassMap passes={passes} />,
    );

    const marker = getAllByRole("button", {
      name: /Player: Ødegaard/,
    })[0] as HTMLElement;

    fireEvent.click(marker);
    expect(getByTestId("passmap-tooltip")).toBeInTheDocument();

    fireEvent.click(marker);
    expect(queryByTestId("passmap-tooltip")).not.toBeInTheDocument();
  });

  it("toggles tooltip on keyboard activation", () => {
    const { getAllByRole, getByTestId, queryByTestId } = render(
      <PassMap passes={passes} />,
    );

    const marker = getAllByRole("button", {
      name: /Player: Ødegaard/,
    })[0] as HTMLElement;

    fireEvent.keyDown(marker, { key: "Enter" });
    expect(getByTestId("passmap-tooltip")).toBeInTheDocument();

    fireEvent.keyDown(marker, { key: " " });
    expect(queryByTestId("passmap-tooltip")).not.toBeInTheDocument();
  });

  it("switches tooltip when hovering between markers", () => {
    const { getAllByRole, getByText, queryByText } = render(<PassMap passes={passes} />);

    const markers = getAllByRole("button");
    fireEvent.mouseEnter(markers[0] as HTMLElement);
    expect(getByText("Ødegaard")).toBeInTheDocument();

    fireEvent.mouseLeave(markers[0] as HTMLElement);
    fireEvent.mouseEnter(markers[1] as HTMLElement);
    expect(getByText("Rice")).toBeInTheDocument();
    expect(queryByText("Ødegaard")).not.toBeInTheDocument();
  });
});

// ─── Prop updates ───────────────────────────────────────────────────

describe("<PassMap /> — prop updates", () => {
  it("updates to the empty state when passes are cleared", async () => {
    function TestHarness() {
      const [currentPasses, setCurrentPasses] = useState(passes);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setCurrentPasses([]);
            }}
          >
            Clear passes
          </button>
          <PassMap passes={currentPasses} />
        </>
      );
    }

    const view = render(<TestHarness />);

    fireEvent.click(view.getByRole("button", { name: "Clear passes" }));

    await waitFor(() => {
      expect(view.getAllByText("No pass data").length).toBeGreaterThan(0);
    });
  });

  it("clears active tooltip when passes change", async () => {
    function TestHarness() {
      const [currentPasses, setCurrentPasses] = useState(passes);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setCurrentPasses(dotPass);
            }}
          >
            Swap passes
          </button>
          <PassMap passes={currentPasses} />
        </>
      );
    }

    const view = render(<TestHarness />);

    const marker = view.getAllByRole("button", {
      name: /Player: Ødegaard/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);
    expect(view.getByTestId("passmap-tooltip")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Swap passes" }));

    await waitFor(() => {
      expect(view.queryByTestId("passmap-tooltip")).not.toBeInTheDocument();
    });
  });
});

// ─── Theme context ──────────────────────────────────────────────────

describe("<PassMap /> — theme context", () => {
  it("uses dark theme colors when wrapped in ThemeProvider", () => {
    const { getByLabelText, getAllByRole, getByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <PassMap passes={passes} />
      </ThemeProvider>,
    );

    expect(getByLabelText(/Pass map: 3 passes/)).toBeInTheDocument();

    const marker = getAllByRole("button", {
      name: /Player: Ødegaard/,
    })[0] as HTMLElement;
    fireEvent.focus(marker);

    const tooltip = getByTestId("passmap-tooltip");
    expect(tooltip).toHaveStyle({
      background: DARK_THEME.surface.tooltip,
    });
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("<PassMap /> — accessibility", () => {
  it("has no axe violations with pass data", async () => {
    const { container } = render(<PassMap passes={passes} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in empty state", async () => {
    const { container } = render(<PassMap passes={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("markers have accessible labels with pass details", () => {
    const { getAllByRole } = render(<PassMap passes={passes} />);

    const markers = getAllByRole("button");
    markers.forEach((marker) => {
      expect(marker).toHaveAttribute("aria-label");
      expect(marker.getAttribute("aria-label")).toMatch(/Player:/);
    });
  });

  it("container has an accessible label describing the chart", () => {
    const { container } = render(<PassMap passes={passes} />);

    const section = container.querySelector("[aria-label]");
    expect(section).not.toBeNull();
    expect(section!.getAttribute("aria-label")).toMatch(/Pass map: \d+ passes/);
  });
});
