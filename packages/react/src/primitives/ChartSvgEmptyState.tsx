import type { UITheme } from "../theme.js";

export function ChartSvgEmptyState({
  x,
  y,
  message,
  theme,
  fontSize = 14,
  fontWeight = 700,
  dominantBaseline,
}: {
  x: number;
  y: number;
  message: string;
  theme: UITheme;
  fontSize?: number;
  fontWeight?: number;
  dominantBaseline?: "auto" | "middle" | "central" | "hanging" | "mathematical";
}) {
  return (
    <text
      data-slot="empty-state"
      x={x}
      y={y}
      textAnchor="middle"
      {...(dominantBaseline ? { dominantBaseline } : {})}
      fill={theme.text.secondary}
      fontSize={fontSize}
      fontWeight={fontWeight}
    >
      {message}
    </text>
  );
}
