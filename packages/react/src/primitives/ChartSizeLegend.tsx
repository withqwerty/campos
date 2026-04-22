import type { UITheme } from "../theme.js";
import { legendTitleStyle } from "./ChartLegend.js";

export type SizeLegendItem = {
  key: string;
  label: string;
  radius: number;
};

export function ChartSizeLegend({
  title,
  items,
  theme,
}: {
  title: string;
  items: SizeLegendItem[];
  theme: UITheme;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={legendTitleStyle(theme)}>{title}</span>
      {items.map((item) => (
        <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={item.radius * 2 + 2} height={item.radius * 2 + 2}>
            <circle
              cx={item.radius + 1}
              cy={item.radius + 1}
              r={item.radius}
              fill={theme.text.secondary}
              opacity={0.5}
            />
          </svg>
          <span style={{ fontSize: 11, color: theme.text.muted }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
