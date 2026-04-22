import type { UITheme } from "../theme.js";

export function ChartWarnings({
  warnings,
  theme,
}: {
  warnings: readonly string[] | undefined;
  theme: UITheme;
}) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div
      data-testid="chart-warnings"
      style={{
        fontSize: 11,
        lineHeight: 1.4,
        color: theme.text.muted,
        borderTop: `1px solid ${theme.border.subtle}`,
        paddingTop: 6,
      }}
    >
      {warnings.map((w, i) => (
        <div key={i}>{w}</div>
      ))}
    </div>
  );
}
