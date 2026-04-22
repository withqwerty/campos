import type { ReactNode } from "react";

import type { UITheme } from "../theme.js";
import { ChartWarnings } from "./ChartWarnings.js";

function SlotBlock({
  children,
  slot,
  testId,
}: {
  children: ReactNode;
  slot: string;
  testId: string;
}) {
  if (children == null) return null;

  return (
    <div data-testid={testId} data-slot={slot} style={{ minWidth: 0 }}>
      {children}
    </div>
  );
}

export function PitchChartFrame({
  ariaLabel,
  chartKind,
  maxWidth,
  prePlot,
  plot,
  postPlot,
  empty = false,
  staticMode = false,
  warnings,
  theme,
  padding = 16,
  gap = 12,
  fontFamily = "inherit",
}: {
  ariaLabel: string;
  chartKind?: string;
  maxWidth: number;
  prePlot?: ReactNode;
  plot: ReactNode;
  postPlot?: ReactNode;
  empty?: boolean;
  staticMode?: boolean;
  warnings?: readonly string[] | undefined;
  theme: UITheme;
  padding?: number;
  gap?: number;
  fontFamily?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      data-slot="frame"
      {...(chartKind ? { "data-chart-kind": chartKind } : {})}
      {...(empty ? { "data-empty": "true" } : {})}
      {...(staticMode ? { "data-static": "true" } : {})}
      style={{
        position: "relative",
        width: "100%",
        maxWidth,
        display: "grid",
        gap,
        padding,
        minWidth: 0,
        color: theme.text.primary,
        background: theme.surface.frame,
        fontFamily,
      }}
    >
      <SlotBlock slot="pre-plot" testId="pitch-chart-pre-plot">
        {prePlot}
      </SlotBlock>
      <div
        data-testid="pitch-chart-plot"
        data-slot="plot"
        style={{ minWidth: 0, color: theme.text.primary }}
      >
        {plot}
      </div>
      <SlotBlock slot="post-plot" testId="pitch-chart-post-plot">
        {postPlot}
      </SlotBlock>
      <ChartWarnings warnings={warnings} theme={theme} />
    </section>
  );
}
