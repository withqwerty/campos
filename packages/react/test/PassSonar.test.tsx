import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

afterEach(cleanup);

import type { PassEvent } from "@withqwerty/campos-schema";

import { PassSonar } from "../src/PassSonar.js";
import { ThemeProvider } from "../src/ThemeContext.js";
import { DARK_THEME } from "../src/theme.js";

let nextId = 0;
function makePass(opts: Partial<PassEvent>): PassEvent {
  nextId += 1;
  return {
    kind: "pass",
    id: opts.id ?? `p-${nextId}`,
    matchId: opts.matchId ?? "m-1",
    teamId: opts.teamId ?? "t-1",
    playerId: opts.playerId ?? "pl-1",
    playerName: opts.playerName ?? null,
    minute: opts.minute ?? 0,
    addedMinute: opts.addedMinute ?? null,
    second: opts.second ?? 0,
    period: opts.period ?? 1,
    x: opts.x ?? null,
    y: opts.y ?? null,
    endX: opts.endX ?? null,
    endY: opts.endY ?? null,
    length: opts.length ?? null,
    angle: opts.angle ?? null,
    recipient: opts.recipient ?? null,
    passType: opts.passType ?? null,
    passResult: opts.passResult ?? null,
    isAssist: opts.isAssist ?? false,
    provider: opts.provider ?? "test",
    providerEventId: opts.providerEventId ?? `${nextId}`,
  };
}

function passAt(
  dx: number,
  dy: number,
  passResult: PassEvent["passResult"] = "complete",
): PassEvent {
  return makePass({ x: 50, y: 50, endX: 50 + dx, endY: 50 + dy, passResult });
}

const SAMPLE_PASSES: PassEvent[] = [
  passAt(10, 0, "complete"),
  passAt(10, 0, "complete"),
  passAt(10, 0, "incomplete"),
  passAt(8, 8, "complete"),
  passAt(0, 10, "complete"),
  passAt(0, 10, "incomplete"),
  passAt(-10, 0, "complete"),
  passAt(0, -10, "complete"),
];

describe("PassSonar", () => {
  test("zero-config render produces 24 wedge groups + legend (default binCount=24)", () => {
    const { getByTestId, getAllByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} subjectLabel="Sample Player" />,
    );
    const wedgeGroup = getByTestId("pass-sonar-wedges");
    expect(wedgeGroup).toBeDefined();
    const wedges = getAllByTestId(/^pass-sonar-wedge-\d+$/);
    expect(wedges).toHaveLength(24);
    expect(getByTestId("pass-sonar-legend")).toBeDefined();
    expect(getByTestId("pass-sonar-summary")).toBeDefined();
  });

  test("binCount={8} produces 8 wedge groups", () => {
    const { getAllByTestId } = render(<PassSonar passes={SAMPLE_PASSES} binCount={8} />);
    const wedges = getAllByTestId(/^pass-sonar-wedge-\d+$/);
    expect(wedges).toHaveLength(8);
  });

  test("binCount={12} produces 12 wedge groups", () => {
    const { getAllByTestId } = render(<PassSonar passes={SAMPLE_PASSES} binCount={12} />);
    const wedges = getAllByTestId(/^pass-sonar-wedge-\d+$/);
    expect(wedges).toHaveLength(12);
  });

  test("empty input renders empty-state message including subject label", () => {
    const { container } = render(<PassSonar passes={[]} subjectLabel="Bukayo Saka" />);
    expect(container.textContent).toContain("No passes for Bukayo Saka");
  });

  test("empty input without subject label falls back to generic copy", () => {
    const { container } = render(<PassSonar passes={[]} />);
    expect(container.textContent).toContain("No passes for this subject");
  });

  test("aria-label on each populated wedge contains label + counts + percentage (binCount=8)", () => {
    const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} binCount={8} />);
    const forwardWedge = getByTestId("pass-sonar-wedge-0");
    const aria = forwardWedge.getAttribute("aria-label") ?? "";
    expect(aria).toContain("forward");
    // Forward bin gets 3 attempted (2 complete, 1 incomplete) → 67% completion.
    expect(aria).toContain("3 attempted");
    expect(aria).toContain("2 completed");
    expect(aria).toContain("67% completion");
  });

  test("subject mismatch warning surfaces in chart-warnings region", () => {
    const passes = [
      passAt(10, 0, "complete"),
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        playerId: "other",
      }),
    ];
    const { container } = render(<PassSonar passes={passes} subjectId="pl-1" />);
    expect(container.textContent).toContain('not matching subject "pl-1"');
  });

  test("scale-max-clamped warning surfaces in chart-warnings region", () => {
    const passes = Array.from({ length: 7 }, () => passAt(10, 0));
    const { container } = render(<PassSonar passes={passes} scaleMaxAttempts={3} />);
    expect(container.textContent).toContain("clamped");
  });

  test("hover surfaces tooltip with documented row order", () => {
    const { getByTestId, queryByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} subjectLabel="Sample" />,
    );
    expect(queryByTestId("pass-sonar-tooltip")).toBeNull();
    fireEvent.mouseEnter(getByTestId("pass-sonar-wedge-0"));
    const tooltip = getByTestId("pass-sonar-tooltip");
    const labels = within(tooltip).getAllByText(
      /Direction|Attempted|Completed|Completion|Average distance/,
    );
    expect(labels[0]?.textContent).toContain("Direction");
  });

  test("tooltip omits 'Average distance' row when wedge has zero attempted passes", () => {
    // Only forward passes; back wedge (index 4 at binCount=8) has zero attempted.
    const { getByTestId, queryByText } = render(
      <PassSonar passes={[passAt(10, 0)]} binCount={8} />,
    );
    fireEvent.mouseEnter(getByTestId("pass-sonar-wedge-4"));
    expect(queryByText("Average distance")).toBeNull();
  });

  test("tooltip includes 'Average distance' row when wedge has attempted passes", () => {
    const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} />);
    fireEvent.mouseEnter(getByTestId("pass-sonar-wedge-0"));
    const tooltip = getByTestId("pass-sonar-tooltip");
    expect(within(tooltip).getByText("Average distance")).toBeDefined();
  });

  test("showLegend=false hides the legend slot", () => {
    const { queryByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} showLegend={false} />,
    );
    expect(queryByTestId("pass-sonar-legend")).toBeNull();
  });

  test("showSummary=false hides the central summary block", () => {
    const { queryByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} showSummary={false} />,
    );
    expect(queryByTestId("pass-sonar-summary")).toBeNull();
  });

  test("directionLabels={false} hides labels", () => {
    const { queryByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} directionLabels={false} />,
    );
    expect(queryByTestId("pass-sonar-direction-labels")).toBeNull();
    expect(queryByTestId("pass-sonar-axis-labels")).toBeNull();
  });

  test('directionLabels="compass" renders the compass rose', () => {
    const { getByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} directionLabels="compass" />,
    );
    expect(getByTestId("pass-sonar-direction-labels")).toBeDefined();
  });

  test('directionLabels="cartesian" renders the four cartesian axis labels', () => {
    const { getByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} directionLabels="cartesian" />,
    );
    const group = getByTestId("pass-sonar-axis-labels");
    const texts = group.querySelectorAll("text");
    // Default cartesian set: forward, back, left, right.
    expect(texts).toHaveLength(4);
  });

  test("directionLabelsText overrides individual cartesian labels", () => {
    const { getByTestId } = render(
      <PassSonar
        passes={SAMPLE_PASSES}
        directionLabels="cartesian"
        directionLabelsText={{ forward: "Attack", back: "", left: "", right: "" }}
      />,
    );
    const group = getByTestId("pass-sonar-axis-labels");
    const texts = group.querySelectorAll("text");
    // Only the non-empty "forward" label renders; empty strings suppress the axis.
    expect(texts).toHaveLength(1);
    expect(texts[0]?.textContent).toBe("Attack");
  });

  test("compass labels are restricted to 8 canonical positions when binCount>8", () => {
    const { getByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} binCount={24} directionLabels="compass" />,
    );
    const labelsGroup = getByTestId("pass-sonar-direction-labels");
    const texts = labelsGroup.querySelectorAll("text");
    // 24 bins but only the 8 canonical directions receive visible labels.
    expect(texts).toHaveLength(8);
  });

  test("compass labels cover every wedge when binCount=8", () => {
    const { getByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} binCount={8} directionLabels="compass" />,
    );
    const labelsGroup = getByTestId("pass-sonar-direction-labels");
    const texts = labelsGroup.querySelectorAll("text");
    expect(texts).toHaveLength(8);
  });

  test("showGuide={false} hides the outer ring and inner hub", () => {
    const { container } = render(
      <PassSonar passes={SAMPLE_PASSES} showGuide={false} showSummary={false} />,
    );
    // GuideRing draws two circles (outer ring + hub) around the centre; with
    // showGuide off we expect none of those on the root sonar SVG (the
    // carousel / chart frame may draw other circles so we scope to direct
    // circles under <g pointerEvents="none">).
    const guideCircles = container.querySelectorAll("g[pointer-events='none'] > circle");
    expect(guideCircles.length).toBe(0);
  });

  test("style callback fires with the documented context shape (binCount=8)", () => {
    const seenLabels: string[] = [];
    render(
      <PassSonar
        passes={SAMPLE_PASSES}
        binCount={8}
        wedges={{
          attemptedFill: ({ label, theme, binIndex }) => {
            // Sanity assertions inside the callback:
            expect(typeof binIndex).toBe("number");
            expect(theme).toBeDefined();
            seenLabels.push(label);
            return undefined;
          },
        }}
      />,
    );
    expect(seenLabels.length).toBe(8);
    expect(seenLabels).toContain("forward");
  });

  test("style constant overrides default fill", () => {
    const { getByTestId } = render(
      <PassSonar passes={SAMPLE_PASSES} wedges={{ attemptedFill: "#abcdef" }} />,
    );
    const forwardWedge = getByTestId("pass-sonar-wedge-0");
    const paths = forwardWedge.querySelectorAll("path");
    expect(paths[0]?.getAttribute("fill")).toBe("#abcdef");
  });

  test("dark theme resolves text colour without crash", () => {
    const { getByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <PassSonar passes={SAMPLE_PASSES} subjectLabel="Sample" />
      </ThemeProvider>,
    );
    expect(getByTestId("pass-sonar-summary")).toBeDefined();
  });

  test("methodologyNotes slot renders when provided", () => {
    const { getByText } = render(
      <PassSonar
        passes={SAMPLE_PASSES}
        methodologyNotes={{ below: <span>Methodology body</span> }}
      />,
    );
    expect(getByText("Methodology body")).toBeDefined();
  });

  test("wedge paths are annular — they do not start at the chart centre", () => {
    // The summary text sits on a centre hub of radius SUMMARY_INNER_R = 36.
    // Wedge paths must not include the centre point (160, 160) — that would
    // mean the wedge fills the hub and obscures the summary.
    const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} />);
    const wedge = getByTestId("pass-sonar-wedge-0");
    const path = wedge.querySelector("path");
    const d = path?.getAttribute("d") ?? "";
    expect(d).not.toContain("M 160 160");
    // The annular wedge must include an inner-arc instruction (A 36 36 ...).
    expect(d).toContain("A 36 36");
  });

  test("hub circle is rendered behind the summary block", () => {
    const { container } = render(<PassSonar passes={SAMPLE_PASSES} />);
    const circles = container.querySelectorAll("circle");
    const hubExists = Array.from(circles).some((c) => c.getAttribute("r") === "36");
    expect(hubExists).toBe(true);
  });

  test("focused wedge sets data-bin-index attribute", () => {
    const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} binCount={8} />);
    const wedge = getByTestId("pass-sonar-wedge-0");
    expect(wedge.getAttribute("data-bin-index")).toBe("0");
    expect(wedge.getAttribute("data-bin-label")).toBe("forward");
  });

  test("ArrowRight key advances activeBin and reveals tooltip (binCount=8)", () => {
    const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} binCount={8} />);
    const wedge0 = getByTestId("pass-sonar-wedge-0");
    fireEvent.focus(wedge0);
    fireEvent.keyDown(wedge0, { key: "ArrowRight" });
    const tooltip = getByTestId("pass-sonar-tooltip");
    expect(within(tooltip).getByText("forward-left")).toBeDefined();
  });

  test("ArrowLeft from binIndex 0 wraps to the last *focusable* wedge (skip-empty nav)", () => {
    // SAMPLE_PASSES populates bins 0, 1, 2, 4, 6 at binCount=8; the "last"
    // wedge in the focusable cycle is bin 6 ("right"), not bin 7 which is
    // empty and not tabbable.
    const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} binCount={8} />);
    const wedge0 = getByTestId("pass-sonar-wedge-0");
    fireEvent.focus(wedge0);
    fireEvent.keyDown(wedge0, { key: "ArrowLeft" });
    const tooltip = getByTestId("pass-sonar-tooltip");
    expect(within(tooltip).getByText("right")).toBeDefined();
  });

  test("ArrowLeft navigation at binCount=24 skips empty bins and lands on the last focusable wedge", () => {
    // At binCount=24 SAMPLE_PASSES only populates bins 0, 3, 6, 12, 18. The
    // "last" focusable wedge in the cycle is bin 18 (canonical "right").
    const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} binCount={24} />);
    const wedge0 = getByTestId("pass-sonar-wedge-0");
    fireEvent.focus(wedge0);
    fireEvent.keyDown(wedge0, { key: "ArrowLeft" });
    const tooltip = getByTestId("pass-sonar-tooltip");
    expect(within(tooltip).getByText("right")).toBeDefined();
  });

  describe("colorBy", () => {
    test('default "completion" renders two stacked paths per populated wedge', () => {
      const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} />);
      const forwardWedge = getByTestId("pass-sonar-wedge-0");
      const paths = forwardWedge.querySelectorAll("path");
      // Forward bin has both complete (2) and incomplete (1) passes → two paths.
      expect(paths.length).toBe(2);
    });

    test('"none" renders a single path per wedge using attempted colour', () => {
      const { getByTestId } = render(<PassSonar passes={SAMPLE_PASSES} colorBy="none" />);
      const forwardWedge = getByTestId("pass-sonar-wedge-0");
      const paths = forwardWedge.querySelectorAll("path");
      expect(paths.length).toBe(1);
    });

    test('"distance" renders a single path per wedge', () => {
      const { getByTestId } = render(
        <PassSonar passes={SAMPLE_PASSES} colorBy="distance" />,
      );
      const forwardWedge = getByTestId("pass-sonar-wedge-0");
      const paths = forwardWedge.querySelectorAll("path");
      expect(paths.length).toBe(1);
    });

    test('"distance" emits a gradient legend, not the completion chip legend', () => {
      const { getByTestId, queryAllByText } = render(
        <PassSonar passes={SAMPLE_PASSES} colorBy="distance" />,
      );
      expect(getByTestId("pass-sonar-legend")).toBeDefined();
      // No "Completed passes" legend row in distance mode.
      expect(queryAllByText("Completed passes")).toHaveLength(0);
      expect(queryAllByText("Avg pass distance").length).toBeGreaterThan(0);
    });

    test('"none" emits a single-item legend (attempted only)', () => {
      const { queryAllByText } = render(
        <PassSonar passes={SAMPLE_PASSES} colorBy="none" />,
      );
      expect(queryAllByText("Attempted passes").length).toBeGreaterThan(0);
      expect(queryAllByText("Completed passes")).toHaveLength(0);
    });

    test('"distance" renders different fills for wedges with different average lengths', () => {
      // Forward: length 10 (short). Back: length 30 (at clip, top of ramp).
      const passes = [
        makePass({
          x: 50,
          y: 50,
          endX: 60,
          endY: 50,
          length: 10,
          passResult: "complete",
        }),
        makePass({
          x: 50,
          y: 50,
          endX: 20,
          endY: 50,
          length: 30,
          passResult: "complete",
        }),
      ];
      const { getByTestId } = render(
        <PassSonar passes={passes} colorBy="distance" binCount={8} />,
      );
      const forwardPath = getByTestId("pass-sonar-wedge-0").querySelector("path");
      const backPath = getByTestId("pass-sonar-wedge-4").querySelector("path");
      expect(forwardPath?.getAttribute("fill")).not.toBe(backPath?.getAttribute("fill"));
    });

    test('"frequency" renders a single path per wedge + gradient legend', () => {
      const { getByTestId, queryAllByText } = render(
        <PassSonar passes={SAMPLE_PASSES} colorBy="frequency" binCount={8} />,
      );
      const forward = getByTestId("pass-sonar-wedge-0");
      expect(forward.querySelectorAll("path").length).toBe(1);
      expect(getByTestId("pass-sonar-legend")).toBeDefined();
      expect(queryAllByText("Passes per bin").length).toBeGreaterThan(0);
    });

    test('"frequency" legend shows "—" end label when there are no passes', () => {
      const { getByTestId } = render(<PassSonar passes={[]} colorBy="frequency" />);
      const legend = getByTestId("pass-sonar-legend");
      expect(legend.textContent).toContain("—");
    });

    test('"frequency" ramp saturates at the busiest bin by default', () => {
      // Two passes forward (bin 0), one pass left (bin 2). Forward should
      // saturate the ramp and therefore differ from left.
      const passes = [
        passAt(10, 0, "complete"),
        passAt(10, 0, "complete"),
        passAt(0, 10, "complete"),
      ];
      const { getByTestId } = render(
        <PassSonar passes={passes} colorBy="frequency" binCount={8} />,
      );
      const forward = getByTestId("pass-sonar-wedge-0").querySelector("path");
      const left = getByTestId("pass-sonar-wedge-2").querySelector("path");
      expect(forward?.getAttribute("fill")).not.toBe(left?.getAttribute("fill"));
    });
  });

  describe('colorBy="metric"', () => {
    const alwaysPositive = () => 0.04;
    const alwaysNegative = () => -0.04;
    const directional = (pass: PassEvent) => ((pass.endX ?? 0) > 50 ? 0.05 : -0.03);

    test("crossing-zero data with metricCenter auto → diverging legend with 0 tick", () => {
      const { getByTestId } = render(
        <PassSonar
          passes={SAMPLE_PASSES}
          colorBy="metric"
          metricForPass={directional}
          binCount={8}
        />,
      );
      const legend = getByTestId("pass-sonar-legend");
      // Diverging legend always includes a centred "0" tick label.
      expect(legend.textContent).toContain("0");
    });

    test("all-positive data with metricCenter auto → min-max legend (no 0 tick by default)", () => {
      const { getByTestId } = render(
        <PassSonar
          passes={SAMPLE_PASSES}
          colorBy="metric"
          metricForPass={alwaysPositive}
          binCount={8}
        />,
      );
      const legend = getByTestId("pass-sonar-legend");
      // Min-max branch renders numeric start/end labels from the observed
      // range; no interior tick mark. Text contains the formatted value.
      expect(legend.textContent).toContain("0.04");
    });

    test("all-negative data with metricCenter auto → min-max legend", () => {
      const { getByTestId } = render(
        <PassSonar
          passes={SAMPLE_PASSES}
          colorBy="metric"
          metricForPass={alwaysNegative}
          binCount={8}
        />,
      );
      const legend = getByTestId("pass-sonar-legend");
      expect(legend.textContent).toContain("-0.04");
    });

    test("metricClipAbs with auto center resolves to zero-centred diverging even on one-sided data", () => {
      // `metricClipAbs` is the caller's signed-intent signal: supplying
      // it forces a diverging ramp centred on 0 with ±clipAbs labels
      // even when every observed bin is one-sided.
      const { getByTestId } = render(
        <PassSonar
          passes={SAMPLE_PASSES}
          colorBy="metric"
          metricForPass={alwaysPositive}
          metricClipAbs={0.05}
          binCount={8}
        />,
      );
      const legend = getByTestId("pass-sonar-legend");
      // Diverging legend emits both -0.05 and +0.05 labels.
      expect(legend.textContent).toContain("-0.05");
      expect(legend.textContent).toContain("+0.05");
    });

    test('metricCenter="zero" forces diverging even when data is one-sided', () => {
      const { getByTestId } = render(
        <PassSonar
          passes={SAMPLE_PASSES}
          colorBy="metric"
          metricForPass={alwaysPositive}
          metricCenter="zero"
          binCount={8}
        />,
      );
      const legend = getByTestId("pass-sonar-legend");
      expect(legend.textContent).toContain("-");
      expect(legend.textContent).toContain("+");
    });

    test('metricCenter="min-max" keeps sequential ramp even when data crosses zero', () => {
      const { getByTestId } = render(
        <PassSonar
          passes={SAMPLE_PASSES}
          colorBy="metric"
          metricForPass={directional}
          metricCenter="min-max"
          binCount={8}
        />,
      );
      const legend = getByTestId("pass-sonar-legend");
      // Min-max branch does NOT draw the interior "0" tick label with a
      // standalone "0" that diverging mode relies on; just observed min/max.
      expect(legend.textContent).toMatch(/-0\.03/);
    });

    test("all-null metric → metricRange is null and legend degrades to min/max placeholder", () => {
      const { getByTestId } = render(
        <PassSonar
          passes={SAMPLE_PASSES}
          colorBy="metric"
          metricForPass={() => null}
          binCount={8}
        />,
      );
      const legend = getByTestId("pass-sonar-legend");
      expect(legend.textContent).toContain("min");
      expect(legend.textContent).toContain("max");
    });
  });
});
