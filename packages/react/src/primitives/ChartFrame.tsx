import type { ReactNode } from "react";

import type { UITheme } from "../theme.js";
import { ChartWarnings } from "./ChartWarnings.js";

export type ChartMethodologyNotes = {
  above?: ReactNode;
  between?: ReactNode;
  below?: ReactNode;
};

function NoteBlock({
  children,
  theme,
  testId,
}: {
  children: ReactNode;
  theme: UITheme;
  testId: string;
}) {
  if (children == null) return null;

  return (
    <div
      data-testid={testId}
      style={{
        fontSize: 12,
        lineHeight: 1.45,
        color: theme.text.muted,
      }}
    >
      {children}
    </div>
  );
}

function SlotBlock({
  children,
  slot,
  testId,
}: {
  children: ReactNode;
  slot: string;
  testId?: string;
}) {
  if (children == null) return null;

  return (
    <div
      {...(testId ? { "data-testid": testId } : {})}
      data-slot={slot}
      style={{ minWidth: 0 }}
    >
      {children}
    </div>
  );
}

export function ChartFrame({
  ariaLabel,
  chartKind,
  maxWidth,
  plot,
  legend,
  empty = false,
  staticMode = false,
  methodologyNotes,
  warnings,
  theme,
  padding = 16,
  gap = 12,
  fontFamily = "inherit",
}: {
  ariaLabel: string;
  chartKind?: string;
  maxWidth: number;
  plot: ReactNode;
  legend?: ReactNode | undefined;
  empty?: boolean;
  staticMode?: boolean;
  methodologyNotes?: ChartMethodologyNotes | undefined;
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
        color: theme.text.primary,
        background: theme.surface.frame,
        fontFamily,
      }}
    >
      <NoteBlock testId="chart-note-above" theme={theme}>
        {methodologyNotes?.above}
      </NoteBlock>
      <div data-slot="plot" style={{ minWidth: 0 }}>
        {plot}
      </div>
      <NoteBlock testId="chart-note-between" theme={theme}>
        {methodologyNotes?.between}
      </NoteBlock>
      <SlotBlock slot="legend">{legend ?? null}</SlotBlock>
      <NoteBlock testId="chart-note-below" theme={theme}>
        {methodologyNotes?.below}
      </NoteBlock>
      <ChartWarnings warnings={warnings} theme={theme} />
    </section>
  );
}
