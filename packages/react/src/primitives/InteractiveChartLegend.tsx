import type { CSSProperties } from "react";

import type { UITheme } from "../theme.js";
import {
  legendTitleStyle,
  type LegendSwatchShape,
  type LegendItem,
} from "./ChartLegend.js";

export type InteractiveLegendItem = LegendItem & {
  /**
   * Optional count to display next to the label — useful when the legend
   * doubles as a filter (e.g. "Save (94)", "Goal (32)"). Formatted in the
   * muted text style so it reads as secondary metadata.
   */
  count?: number;
};

/**
 * Legend-filter interaction mode:
 *
 * - `"focus"`: clicking an inactive item selects only it (others turn off);
 *   clicking the already-focused item clears the filter (all items back on);
 *   clicking a different item switches focus to it. This is the natural UX
 *   for 2-item legends where "show none" is useless — the user always ends
 *   up in "show all", "show only A", or "show only B".
 * - `"multi-select"`: each item is independently toggled. Clicking one never
 *   affects the others. Natural for 3+ items where users want to mix and
 *   match (e.g. "show A and C but not B").
 *
 * When unspecified, `InteractiveChartLegend` defaults to `"focus"` for
 * legends with 2 items and `"multi-select"` for 3+.
 */
export type InteractiveLegendMode = "focus" | "multi-select";

export type InteractiveChartLegendProps = {
  items: readonly InteractiveLegendItem[];
  /** Record of item-key → active. Missing keys are treated as active. */
  value: Readonly<Record<string, boolean>>;
  onChange: (next: Record<string, boolean>) => void;
  mode?: InteractiveLegendMode;
  title?: string;
  swatchShape?: LegendSwatchShape;
  theme: UITheme;
  testId?: string;
  /** Dim factor for inactive items. 0 = invisible, 1 = no dim. Default: `0.35`. */
  inactiveOpacity?: number;
};

function resolveMode(
  explicit: InteractiveLegendMode | undefined,
  itemCount: number,
): InteractiveLegendMode {
  if (explicit != null) return explicit;
  return itemCount <= 2 ? "focus" : "multi-select";
}

export function nextInteractiveLegendValue(
  current: Readonly<Record<string, boolean>>,
  keys: readonly string[],
  clickedKey: string,
  mode: InteractiveLegendMode,
): Record<string, boolean> {
  const normalized = Object.fromEntries(
    keys.map((k) => [k, current[k] ?? true]),
  ) as Record<string, boolean>;

  if (mode === "multi-select") {
    return { ...normalized, [clickedKey]: !normalized[clickedKey] };
  }

  // focus mode
  const activeKeys = keys.filter((k) => normalized[k]);
  const isSoloActive = activeKeys.length === 1 && activeKeys[0] === clickedKey;
  if (isSoloActive) {
    return Object.fromEntries(keys.map((k) => [k, true])) as Record<string, boolean>;
  }
  return Object.fromEntries(keys.map((k) => [k, k === clickedKey])) as Record<
    string,
    boolean
  >;
}

/**
 * Categorical legend with built-in filter interaction. Renders each item as
 * a button whose active state reflects `value[key]`; clicks are translated
 * into filter updates via the supplied `mode` (focus vs. multi-select).
 *
 * Use this for any chart where the legend also controls visibility:
 * goal-mouth save/goal filters, shot-map outcome filters, pass-type legends,
 * etc. For a read-only legend use `ChartLegend` instead.
 */
export function InteractiveChartLegend({
  items,
  value,
  onChange,
  mode,
  title,
  swatchShape = "circle",
  theme,
  testId,
  inactiveOpacity = 0.35,
}: InteractiveChartLegendProps) {
  const resolvedMode = resolveMode(mode, items.length);
  const keys = items.map((item) => item.key);

  return (
    <div
      {...(testId != null ? { "data-testid": testId } : {})}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        color: theme.text.secondary,
      }}
    >
      {title != null ? <span style={legendTitleStyle(theme)}>{title}</span> : null}
      {items.map((item) => {
        const active = value[item.key] ?? true;
        const buttonStyle: CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 8px 2px 4px",
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: 999,
          cursor: "pointer",
          opacity: active ? 1 : inactiveOpacity,
          transition: "opacity 120ms ease",
          color: theme.text.secondary,
          font: "inherit",
          fontSize: 12,
        };
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              onChange(nextInteractiveLegendValue(value, keys, item.key, resolvedMode));
            }}
            aria-pressed={active}
            aria-label={item.count != null ? `${item.label} (${item.count})` : item.label}
            style={buttonStyle}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: swatchShape === "circle" ? "50%" : 2,
                background: item.color,
              }}
            />
            <span style={{ fontWeight: 600 }}>{item.label}</span>
            {item.count != null ? (
              <span style={{ color: theme.text.muted }}>({item.count})</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
