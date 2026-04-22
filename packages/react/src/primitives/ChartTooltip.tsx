import type { UITheme } from "../theme.js";

export type TooltipRow = { label: string; value: string };

/**
 * Shared tooltip component used by all chart types.
 * Renders a positioned card with key-value rows.
 */
export function ChartTooltip({
  rows,
  testId,
  theme,
}: {
  rows: TooltipRow[];
  testId: string;
  theme: UITheme;
}) {
  return (
    <div
      data-testid={testId}
      data-slot="tooltip"
      style={{
        position: "absolute",
        right: 16,
        top: 16,
        minWidth: 140,
        padding: "10px 12px",
        borderRadius: theme.radius.lg,
        background: theme.surface.tooltip,
        border: `1px solid ${theme.border.tooltip}`,
        color: theme.text.primary,
        boxShadow: theme.shadow.tooltip,
        pointerEvents: "none",
      }}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            lineHeight: 1.4,
            marginTop: i === 0 ? 0 : 4,
          }}
        >
          <span style={{ color: theme.text.muted }}>{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
