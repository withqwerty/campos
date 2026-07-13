import type { CSSProperties } from "react";

import type { UITheme } from "../theme.js";
import { ChartPointMark, type PointShape } from "./ChartPointMark.js";

export type LegendItem = {
  key: string;
  label: string;
  color: string;
};

export type LegendSwatchShape = "square" | "circle";

export type ChartLegendItem =
  | LegendItem
  | {
      kind: "marker";
      key: string;
      label: string;
      shape: PointShape;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      kind: "line";
      key: string;
      label: string;
      color: string;
      width: number;
      dash?: string;
    }
  | {
      kind: "range";
      key: string;
      label: string;
      sample: "marker" | "line";
      color: string;
      minSize: number;
      maxSize: number;
      minLabel: string;
      maxLabel: string;
    };

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
 * Shared finite legend grammar for categorical markers and line samples.
 *
 * This intentionally accepts semantic descriptors rather than arbitrary JSX so
 * chart models keep ownership of their football meaning while rendering stays
 * consistent across components.
 */
export function ChartLegend({
  items,
  testId,
  title,
  swatchShape = "square",
  theme,
}: {
  items: readonly ChartLegendItem[];
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
      {items.map((item) =>
        "kind" in item && item.kind === "range" ? (
          <LegendRange key={item.key} item={item} theme={theme} />
        ) : (
          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <LegendSwatch item={item} swatchShape={swatchShape} />
            <span>{item.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

function LegendRange({
  item,
  theme,
}: {
  item: Extract<ChartLegendItem, { kind: "range" }>;
  theme: UITheme;
}) {
  const isMarker = item.sample === "marker";
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={legendTitleStyle(theme)}>{item.label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <svg width={36} height={16} aria-hidden="true">
          {isMarker ? (
            <>
              <circle cx={6} cy={8} r={item.minSize} fill={item.color} />
              <circle cx={26} cy={8} r={item.maxSize} fill={item.color} />
            </>
          ) : (
            <>
              <line
                x1={2}
                y1={8}
                x2={16}
                y2={8}
                stroke={item.color}
                strokeWidth={item.minSize}
              />
              <line
                x1={20}
                y1={8}
                x2={34}
                y2={8}
                stroke={item.color}
                strokeWidth={item.maxSize}
              />
            </>
          )}
        </svg>
        <span style={{ opacity: 0.8 }}>{item.minLabel}</span>
        <span aria-hidden="true" style={{ opacity: 0.4 }}>
          →
        </span>
        <span style={{ opacity: 0.8 }}>{item.maxLabel}</span>
      </div>
    </div>
  );
}

function LegendSwatch({
  item,
  swatchShape,
}: {
  item: ChartLegendItem;
  swatchShape: LegendSwatchShape;
}) {
  if ("kind" in item && item.kind === "marker") {
    return (
      <svg width={14} height={14} aria-hidden="true" style={{ display: "block" }}>
        <ChartPointMark
          cx={7}
          cy={7}
          r={5}
          shape={item.shape}
          fill={item.fill}
          {...(item.stroke != null ? { stroke: item.stroke } : {})}
          {...(item.strokeWidth != null ? { strokeWidth: item.strokeWidth } : {})}
        />
      </svg>
    );
  }

  if ("kind" in item && item.kind === "line") {
    return (
      <svg width={16} height={12} aria-hidden="true" style={{ display: "block" }}>
        <line
          x1={1}
          y1={6}
          x2={15}
          y2={6}
          stroke={item.color}
          strokeWidth={item.width}
          strokeLinecap="round"
          {...(item.dash != null ? { strokeDasharray: item.dash } : {})}
        />
      </svg>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: swatchShape === "circle" ? "50%" : 2,
        background: item.color,
      }}
    />
  );
}
