import type { CSSProperties } from "react";

import type { UITheme } from "../theme.js";

export type LegendItem = {
  key: string;
  label: string;
  color: string;
};

export type LegendSwatchShape = "square" | "circle";

export function legendTitleStyle(theme: UITheme): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: theme.text.muted,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };
}

/**
 * Shared categorical legend — colored swatch + label list.
 */
export function ChartLegend({
  items,
  testId,
  title,
  swatchShape = "square",
  theme,
}: {
  items: LegendItem[];
  testId?: string;
  title?: string;
  swatchShape?: LegendSwatchShape;
  theme: UITheme;
}) {
  return (
    <div
      {...(testId ? { "data-testid": testId } : {})}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        color: theme.text.secondary,
      }}
    >
      {title ? <span style={legendTitleStyle(theme)}>{title}</span> : null}
      {items.map((item) => (
        <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: swatchShape === "circle" ? "50%" : 2,
              background: item.color,
            }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
