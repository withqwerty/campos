import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PercentileBar,
  PercentilePill,
  percentileBarRecipes,
  percentilePillRecipes,
} from "../src/index";
import { resolvePercentileSurfaceModel } from "../src/compute/percentile-surface.js";

afterEach(cleanup);

const SAMPLE = {
  label: "Big Five League midfielders",
  seasonLabel: "2025/26",
  minutesThresholdLabel: "900+ minutes",
};

const PROG_PASSES = {
  id: "prog-passes",
  label: "Progressive passes",
  percentile: 87,
  rawValue: 7.4,
  rawValueUnit: " /90",
} as const;

const DISPOSSESSED_LOWER = {
  id: "dispossessed",
  label: "Dispossessed",
  percentile: 84,
  rawValue: 0.4,
  rawValueUnit: " /90",
  originalDirection: "lower",
} as const;

describe("<PercentileBar /> — rendering", () => {
  it("renders the metric label, sample label, and percentile text", () => {
    const { container } = render(
      <PercentileBar metric={PROG_PASSES} comparison={SAMPLE} />,
    );
    expect(container.querySelector('[data-slot="percentile-bar"]')).toBeTruthy();
    expect(
      container.querySelector('[data-slot="percentile-bar-metric-label"]')?.textContent,
    ).toBe("Progressive passes");
    expect(
      container.querySelector('[data-slot="percentile-bar-sample-label"]')?.textContent,
    ).toBe(SAMPLE.label);
    expect(
      container.querySelector('[data-slot="percentile-bar-percentile-label"]')
        ?.textContent,
    ).toBe("87");
    expect(
      container.querySelector('[data-slot="percentile-bar-value-label"]')?.textContent,
    ).toBe("7.4 /90");
  });

  it("keeps the sample text in the aria-label when showComparisonLabel=false", () => {
    const { container } = render(
      <PercentileBar
        metric={PROG_PASSES}
        comparison={SAMPLE}
        showComparisonLabel={false}
      />,
    );
    const svg = container.querySelector<SVGElement>('[data-slot="percentile-bar"]');
    expect(svg?.querySelector('[data-slot="percentile-bar-sample-label"]')).toBeFalsy();
    const ariaLabel = svg?.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain(SAMPLE.label);
    expect(ariaLabel).toContain("87th percentile");
  });

  it("renders three reference ticks at 25 / 50 / 75 by default", () => {
    const { container } = render(
      <PercentileBar metric={PROG_PASSES} comparison={SAMPLE} />,
    );
    const ticks = container.querySelectorAll('[data-slot="percentile-bar-tick"]');
    expect(ticks).toHaveLength(3);
    expect(Array.from(ticks).map((t) => t.getAttribute("data-tick-value"))).toEqual([
      "25",
      "50",
      "75",
    ]);
  });

  it("renders the default inversion badge for lower-is-better metrics", () => {
    const { container, getByText } = render(
      <PercentileBar metric={DISPOSSESSED_LOWER} comparison={SAMPLE} />,
    );
    const badge = container.querySelector('[data-slot="percentile-bar-inversion-badge"]');
    expect(badge).toBeTruthy();
    expect(getByText("lower is better")).toBeInTheDocument();
  });

  it("supports overriding the inversion badge label", () => {
    const { getByText } = render(
      <PercentileBar
        metric={DISPOSSESSED_LOWER}
        comparison={SAMPLE}
        inversionBadgeLabel="reversed"
      />,
    );
    expect(getByText("reversed")).toBeInTheDocument();
  });

  it("hides the visible inversion badge when inversionBadgeLabel is empty but keeps the inversion note in aria-label", () => {
    const { container } = render(
      <PercentileBar
        metric={DISPOSSESSED_LOWER}
        comparison={SAMPLE}
        inversionBadgeLabel=""
      />,
    );
    expect(
      container.querySelector('[data-slot="percentile-bar-inversion-badge"]'),
    ).toBeFalsy();
    const svg = container.querySelector('[data-slot="percentile-bar"]');
    expect(svg?.getAttribute("aria-label")).toContain("lower is better");
  });

  it("assembles the structured accessibleLabel from compute fields", () => {
    const model = resolvePercentileSurfaceModel({
      metric: PROG_PASSES,
      comparison: SAMPLE,
      requireComparisonLabel: true,
    });
    expect(model.accessibleLabel).toEqual({
      metricLabel: "Progressive passes",
      percentileText: "87th percentile",
      sampleText: SAMPLE.label,
    });
    const lowerModel = resolvePercentileSurfaceModel({
      metric: DISPOSSESSED_LOWER,
      comparison: SAMPLE,
      requireComparisonLabel: true,
    });
    expect(lowerModel.accessibleLabel).toMatchObject({
      inversionNote: "lower is better",
    });
  });

  it("sets direction='ltr' on the root svg even inside dir='rtl' context", () => {
    const { container } = render(
      <div dir="rtl">
        <PercentileBar metric={PROG_PASSES} comparison={SAMPLE} />
      </div>,
    );
    const svg = container.querySelector<SVGElement>('[data-slot="percentile-bar"]');
    expect(svg?.getAttribute("direction")).toBe("ltr");
  });

  it("focuses the root svg via tabIndex=0", () => {
    const { container } = render(
      <PercentileBar metric={PROG_PASSES} comparison={SAMPLE} />,
    );
    const svg = container.querySelector<SVGElement>('[data-slot="percentile-bar"]');
    expect(svg?.getAttribute("tabindex")).toBe("0");
  });

  it("accepts constant style overrides for track and fill", () => {
    const { container } = render(
      <PercentileBar
        metric={PROG_PASSES}
        comparison={SAMPLE}
        track={{ fill: "#aaa" }}
        fill={{ fill: "#111" }}
      />,
    );
    expect(
      container.querySelector('[data-slot="percentile-bar-track"]')?.getAttribute("fill"),
    ).toBe("#aaa");
    expect(
      container.querySelector('[data-slot="percentile-bar-fill"]')?.getAttribute("fill"),
    ).toBe("#111");
  });

  it("accepts callback style overrides keyed on percentile context", () => {
    const { container } = render(
      <PercentileBar
        metric={PROG_PASSES}
        comparison={SAMPLE}
        fill={{ fill: (ctx) => (ctx.percentile >= 80 ? "#0a0" : "#a00") }}
      />,
    );
    expect(
      container.querySelector('[data-slot="percentile-bar-fill"]')?.getAttribute("fill"),
    ).toBe("#0a0");
  });

  it("renders the empty-state primitive for invalid input", () => {
    const { container } = render(
      <PercentileBar
        metric={{
          id: "broken",
          label: "Broken",
          percentile: Number.NaN,
        }}
        comparison={SAMPLE}
      />,
    );
    expect(container.querySelector('[data-slot="empty-state"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="percentile-bar-fill"]')).toBeFalsy();
  });

  it("calls onWarnings with clamp warnings for out-of-range percentiles", async () => {
    const onWarnings = vi.fn();
    render(
      <PercentileBar
        metric={{
          id: "clamp",
          label: "Clamp",
          percentile: 120,
        }}
        comparison={SAMPLE}
        onWarnings={onWarnings}
      />,
    );
    // useEffect fires asynchronously after render
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onWarnings).toHaveBeenCalledTimes(1);
    const warnings = onWarnings.mock.calls[0]?.[0] as readonly string[];
    expect(warnings[0]).toMatch(/clamped to 100/);
  });

  it("applies a recipe's track style and lets direct overrides win", () => {
    const { container, rerender } = render(
      <PercentileBar
        metric={PROG_PASSES}
        comparison={SAMPLE}
        recipe={percentileBarRecipes.quiet}
      />,
    );
    // Recipe sets track opacity to 0.6 — render should pick that up.
    const trackOpacity = container
      .querySelector('[data-slot="percentile-bar-track"]')
      ?.getAttribute("opacity");
    expect(trackOpacity).toBe("0.6");

    rerender(
      <PercentileBar
        metric={PROG_PASSES}
        comparison={SAMPLE}
        recipe={percentileBarRecipes.quiet}
        track={{ opacity: 0.2 }}
      />,
    );
    const overriddenOpacity = container
      .querySelector('[data-slot="percentile-bar-track"]')
      ?.getAttribute("opacity");
    expect(overriddenOpacity).toBe("0.2");
  });
});

describe("<PercentileBar /> — leading value badge", () => {
  it("is off by default", () => {
    const { container } = render(
      <PercentileBar
        metric={{ id: "m", label: "m", percentile: 72 }}
        comparison={{ label: "Pool" }}
      />,
    );
    expect(
      container.querySelector('[data-slot="percentile-bar-leading-badge"]'),
    ).toBeNull();
  });

  it("renders a circular chip containing the rounded percentile when enabled", () => {
    const { container } = render(
      <PercentileBar
        metric={{ id: "m", label: "m", percentile: 72.4 }}
        comparison={{ label: "Pool" }}
        leadingBadge={{ visible: true, fill: "#ea580c", textFill: "#ffffff" }}
      />,
    );
    const badge = container.querySelector('[data-slot="percentile-bar-leading-badge"]');
    expect(badge).not.toBeNull();
    const circle = badge!.querySelector("circle");
    const text = badge!.querySelector("text");
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute("fill")).toBe("#ea580c");
    expect(text!.textContent).toBe("72");
    expect(text!.getAttribute("fill")).toBe("#ffffff");
  });

  it("shrinks the track to make room so the percentile fill still fits", () => {
    const { container: base } = render(
      <PercentileBar
        metric={{ id: "m", label: "m", percentile: 100 }}
        comparison={{ label: "Pool" }}
      />,
    );
    const baseTrackWidth = Number(
      base.querySelector('[data-slot="percentile-bar-track"]')!.getAttribute("width"),
    );

    const { container: withBadge } = render(
      <PercentileBar
        metric={{ id: "m", label: "m", percentile: 100 }}
        comparison={{ label: "Pool" }}
        leadingBadge={{ visible: true }}
      />,
    );
    const badgedTrackWidth = Number(
      withBadge
        .querySelector('[data-slot="percentile-bar-track"]')!
        .getAttribute("width"),
    );
    expect(badgedTrackWidth).toBeLessThan(baseTrackWidth);

    const fillWidth = Number(
      withBadge.querySelector('[data-slot="percentile-bar-fill"]')!.getAttribute("width"),
    );
    expect(fillWidth).toBeCloseTo(badgedTrackWidth, 1);
  });

  it("accepts a callback visibility predicate keyed on percentile", () => {
    const { container: hidden } = render(
      <PercentileBar
        metric={{ id: "m", label: "m", percentile: 40 }}
        comparison={{ label: "Pool" }}
        leadingBadge={{ visible: ({ percentile }) => percentile >= 50 }}
      />,
    );
    const { container: shown } = render(
      <PercentileBar
        metric={{ id: "m", label: "m", percentile: 80 }}
        comparison={{ label: "Pool" }}
        leadingBadge={{ visible: ({ percentile }) => percentile >= 50 }}
      />,
    );
    expect(hidden.querySelector('[data-slot="percentile-bar-leading-badge"]')).toBeNull();
    expect(
      shown.querySelector('[data-slot="percentile-bar-leading-badge"]'),
    ).not.toBeNull();
  });
});

describe("<PercentilePill /> — rendering", () => {
  it("renders the label and concatenated value", () => {
    const { container } = render(
      <PercentilePill
        metric={{
          id: "tkl",
          label: "Tackles won",
          percentile: 73,
          rawValue: 2.1,
          rawValueUnit: " /90",
        }}
        comparison={SAMPLE}
      />,
    );
    expect(
      container.querySelector('[data-slot="percentile-pill-metric-label"]')?.textContent,
    ).toBe("Tackles won");
    const valueText = container.querySelector(
      '[data-slot="percentile-pill-percentile-label"]',
    )?.textContent;
    expect(valueText).toContain("73");
    expect(valueText).toContain("2.1 /90");
  });

  it("exposes the sample text via aria-label when accessibleSampleLabel is used", () => {
    const { container } = render(
      <PercentilePill
        metric={{ id: "tkl", label: "Tackles won", percentile: 73 }}
        accessibleSampleLabel="vs centre-backs, 2025/26"
      />,
    );
    const svg = container.querySelector('[data-slot="percentile-pill"]');
    expect(svg?.getAttribute("aria-label")).toContain("vs centre-backs, 2025/26");
  });

  it("hides the raw value under percentilePillRecipes.compact", () => {
    const { container } = render(
      <PercentilePill
        metric={{
          id: "tkl",
          label: "Tackles won",
          percentile: 73,
          rawValue: 2.1,
          rawValueUnit: " /90",
        }}
        comparison={SAMPLE}
        recipe={percentilePillRecipes.compact}
      />,
    );
    const valueText = container.querySelector(
      '[data-slot="percentile-pill-percentile-label"]',
    )?.textContent;
    expect(valueText).not.toContain("/90");
    expect(valueText).toContain("73");
  });
});
