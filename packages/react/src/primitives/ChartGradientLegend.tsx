import type { UITheme } from "../theme.js";
import { legendTitleStyle } from "./ChartLegend.js";

/** Optional tick mark drawn below the gradient bar. `at` is normalised [0..1]. */
export type ChartGradientLegendTick = {
  /** Normalised position along the gradient, `0` at the left edge, `1` at the right. */
  at: number;
  label: string;
};

export type ChartGradientLegendProps = {
  title: string;
  startLabel: string;
  endLabel: string;
  colors: string[];
  theme: UITheme;
  /**
   * Optional interior tick labels drawn underneath the gradient bar. Use for
   * diverging legends (`-4%`, `Avg`, `+4%`) or any time the start/end alone
   * aren't enough context. Renders the tick mark as a small vertical line
   * and a label underneath.
   */
  ticks?: ReadonlyArray<ChartGradientLegendTick>;
  /** Pixel width of the gradient bar. Default `80`; widen for labelled ticks. */
  width?: number;
};

export function ChartGradientLegend({
  title,
  startLabel,
  endLabel,
  colors,
  theme,
  ticks,
  width = 80,
}: ChartGradientLegendProps) {
  const hasTicks = ticks != null && ticks.length > 0;
  const barHeight = 8;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={legendTitleStyle(theme)}>{title}</span>
      <span style={{ fontSize: 11, color: theme.text.muted }}>{startLabel}</span>
      <div
        style={{
          position: "relative",
          width,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            width: "100%",
            height: barHeight,
            borderRadius: theme.radius.sm,
            background: `linear-gradient(90deg, ${colors.join(", ")})`,
          }}
        />
        {hasTicks ? (
          <div style={{ position: "relative", height: 14, marginTop: 2 }}>
            {ticks.map((tick, idx) => {
              const clamped = Math.max(0, Math.min(1, tick.at));
              if (process.env.NODE_ENV !== "production" && (tick.at < 0 || tick.at > 1)) {
                console.warn(
                  `ChartGradientLegend: tick "${tick.label}" has at=${tick.at}, clamped to ${clamped}. ` +
                    `ticks.at should be in [0, 1].`,
                );
              }
              return (
                <div
                  key={`${tick.label}-${idx}`}
                  style={{
                    position: "absolute",
                    left: `${clamped * 100}%`,
                    transform: "translateX(-50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    lineHeight: 1,
                  }}
                >
                  <div
                    style={{
                      width: 1,
                      height: 4,
                      background: theme.text.muted,
                      opacity: 0.7,
                    }}
                  />
                  <span style={{ fontSize: 10, color: theme.text.muted, marginTop: 2 }}>
                    {tick.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <span style={{ fontSize: 11, color: theme.text.muted }}>{endLabel}</span>
    </div>
  );
}
