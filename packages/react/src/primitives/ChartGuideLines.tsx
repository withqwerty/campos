import type { UITheme } from "../theme.js";

export type ChartGuideLine = {
  axis: "x" | "y";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string | null;
  stroke: string | null;
  strokeDasharray: string | null;
};

export function ChartGuideLines({
  guides,
  plotTop,
  theme,
}: {
  guides: readonly ChartGuideLine[];
  plotTop: number;
  theme: UITheme;
}) {
  if (guides.length === 0) {
    return null;
  }

  return (
    <>
      {guides.map((guide, index) => (
        <g key={`guide-${index}`} aria-hidden="true">
          <line
            x1={guide.x1}
            y1={guide.y1}
            x2={guide.x2}
            y2={guide.y2}
            stroke={guide.stroke ?? theme.axis.line}
            strokeWidth={1}
            strokeDasharray={guide.strokeDasharray ?? undefined}
            opacity={0.7}
          />
          {guide.label ? (
            <text
              x={guide.axis === "x" ? guide.x1 + 4 : guide.x2 - 4}
              y={guide.axis === "x" ? plotTop + 12 : guide.y1 - 6}
              textAnchor={guide.axis === "x" ? "start" : "end"}
              fill={theme.text.muted}
              fontSize={10}
              fontWeight={600}
            >
              {guide.label}
            </text>
          ) : null}
        </g>
      ))}
    </>
  );
}
