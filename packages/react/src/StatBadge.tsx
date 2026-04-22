import type { CSSProperties, ReactElement } from "react";

import { useTheme } from "./ThemeContext.js";

/**
 * A single stat for the StatBadge / StatBadgeRow primitive.
 *
 * `home` and `away` are already-formatted display strings ("56%", "1.8 xG").
 * Supply optional raw `homeValue` / `awayValue` numbers when you want the
 * proportional bar or numeric (rather than string-equality) emphasis.
 */
export type Stat = {
  /** Display label, e.g. "Possession", "Shots on target", "xG". */
  label: string;
  /** Already-formatted display value for the home team. */
  home: string;
  /** Already-formatted display value for the away team. */
  away: string;
  /**
   * Optional raw numeric value for the home team. Used for the
   * proportional bar and the bold-the-winner emphasis. If omitted,
   * the badge falls back to string equality for the tie check and
   * the bar is suppressed.
   */
  homeValue?: number;
  /** Optional raw numeric value for the away team. */
  awayValue?: number;
  /**
   * If false, lower values win the emphasis (e.g. fouls committed,
   * errors leading to goals). Defaults to true.
   */
  higherIsBetter?: boolean;
  /**
   * Render a proportional split bar under the values. Requires both
   * `homeValue` and `awayValue` to be finite and non-negative; otherwise
   * the bar is silently omitted.
   */
  bar?: boolean;
};

export type StatBadgeOrientation = "horizontal" | "vertical";

export type StatBadgeSideStyle = {
  /** Colour for the side's proportional bar segment. */
  barColor?: string;
  /** Colour for the side's value when it is not winning. */
  valueColor?: string;
  /** Colour for the side's value when it is the winner or part of a tie. */
  winnerValueColor?: string;
};

export type StatBadgeLabelStyle = {
  color?: string;
};

export type StatBadgeBarStyle = {
  trackColor?: string;
};

export type StatBadgeChromeStyle = {
  backgroundColor?: string;
};

export type StatBadgeStyles = {
  home?: StatBadgeSideStyle;
  away?: StatBadgeSideStyle;
  label?: StatBadgeLabelStyle;
  bar?: StatBadgeBarStyle;
  chrome?: StatBadgeChromeStyle;
};

/** Props for a single `StatBadge`. */
export type StatBadgeProps = {
  /** The stat to render. */
  stat: Stat;
  /** Semantic style tokens for the badge chrome, values, and bar. */
  styles?: StatBadgeStyles;
  /** Layout orientation. @default "horizontal" */
  orientation?: StatBadgeOrientation;
};

/** Props for `StatBadgeRow`. */
export type StatBadgeRowProps = {
  /** Stats to render. Empty array renders an empty section without crashing. */
  stats: Stat[];
  /** Semantic style tokens shared by each badge in the row. */
  styles?: StatBadgeStyles;
  /** Layout orientation. @default "horizontal" */
  orientation?: StatBadgeOrientation;
  /** Override the section's accessible label. @default "Match statistics" */
  ariaLabel?: string;
};

const DEFAULT_HOME_COLOR = "#1d4ed8"; // mid blue
const DEFAULT_AWAY_COLOR = "#b91c1c"; // mid red
const DEFAULT_ARIA_LABEL = "Match statistics";
const MISSING_VALUE = "—";

type Side = "home" | "away" | "tie" | "neutral";

/**
 * Determine which side wins for emphasis purposes.
 *
 * Numeric comparison wins when both raw values are present and finite.
 * When values are non-numeric and differ, we return "neutral" rather than
 * "tie" — bolding both sides when neither demonstrably won is misleading.
 */
function determineWinner(stat: Stat): Side {
  const higherIsBetter = stat.higherIsBetter ?? true;
  const homeNum = stat.homeValue;
  const awayNum = stat.awayValue;
  const haveNumeric =
    typeof homeNum === "number" &&
    Number.isFinite(homeNum) &&
    typeof awayNum === "number" &&
    Number.isFinite(awayNum);

  if (haveNumeric) {
    if (homeNum === awayNum) return "tie";
    if (higherIsBetter) {
      return homeNum > awayNum ? "home" : "away";
    }
    return homeNum < awayNum ? "home" : "away";
  }

  // String equality is a genuine tie; differing strings are non-comparable
  if (stat.home === stat.away) return "tie";
  return "neutral";
}

type BarShares = { home: number; away: number; degenerate: boolean } | null;

/**
 * Compute proportional shares for the bar. Returns null when the bar
 * cannot be rendered (missing values, NaN, negative numbers).
 *
 * `degenerate: true` means the values are present but sum to zero —
 * we render a 50/50 split with reduced opacity rather than disappear.
 */
function computeBarShares(stat: Stat): BarShares {
  if (stat.bar !== true) return null;
  const homeNum = stat.homeValue;
  const awayNum = stat.awayValue;
  if (typeof homeNum !== "number" || !Number.isFinite(homeNum)) return null;
  if (typeof awayNum !== "number" || !Number.isFinite(awayNum)) return null;
  if (homeNum < 0 || awayNum < 0) return null;
  const total = homeNum + awayNum;
  if (total === 0) {
    return { home: 0.5, away: 0.5, degenerate: true };
  }
  return { home: homeNum / total, away: awayNum / total, degenerate: false };
}

function valueOrPlaceholder(value: string | undefined): string {
  if (value == null || value.length === 0) return MISSING_VALUE;
  return value;
}

function labelStyle(labelColor: string): CSSProperties {
  return {
    ...LABEL_BASE_STYLE,
    color: labelColor,
  };
}

function buildBadgeAriaLabel(stat: Stat): string {
  const home = valueOrPlaceholder(stat.home);
  const away = valueOrPlaceholder(stat.away);
  return `${stat.label}: home ${home}, away ${away}`;
}

const BADGE_BASE_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  padding: "0.5rem 0.25rem",
  minWidth: 0,
};

const HORIZONTAL_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "baseline",
  columnGap: "0.75rem",
  minWidth: 0,
};

const VERTICAL_STACK_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  rowGap: "0.25rem",
  minWidth: 0,
};

const LABEL_BASE_STYLE: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textAlign: "center",
  lineHeight: 1.25,
  // Allow long labels to wrap inside their grid cell.
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  maxWidth: "100%",
};

const VALUE_BASE_STYLE: CSSProperties = {
  fontSize: "1.25rem",
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.1,
};

function valueStyle(
  side: "home" | "away",
  winner: Side,
  themeColors: { primary: string; secondary: string },
  style: StatBadgeSideStyle | undefined,
): CSSProperties {
  const isWinner = winner === side || winner === "tie";
  return {
    ...VALUE_BASE_STYLE,
    fontWeight: isWinner ? 800 : 500,
    color: isWinner
      ? (style?.winnerValueColor ?? themeColors.primary)
      : (style?.valueColor ?? themeColors.secondary),
  };
}

const BAR_TRACK_BASE_STYLE: CSSProperties = {
  display: "flex",
  width: "100%",
  height: "6px",
  borderRadius: "3px",
  overflow: "hidden",
};

function barTrackStyle(trackColor: string): CSSProperties {
  return {
    ...BAR_TRACK_BASE_STYLE,
    background: trackColor,
  };
}

/**
 * StatBadge — single comparison badge for one stat.
 *
 * Renders home value, label, and away value. The winning side is bolded
 * (configurable per-stat via `higherIsBetter`). Optionally renders a
 * proportional split bar underneath when `stat.bar === true` and raw
 * numeric values are supplied.
 *
 * Static, accessible HTML — no SVG, no compute, no client JS required.
 */
export function StatBadge(props: StatBadgeProps): ReactElement {
  const { stat, styles, orientation = "horizontal" } = props;

  const theme = useTheme();
  const winner = determineWinner(stat);
  const bar = computeBarShares(stat);
  const ariaLabel = buildBadgeAriaLabel(stat);
  const homeText = valueOrPlaceholder(stat.home);
  const awayText = valueOrPlaceholder(stat.away);

  const bodyStyle =
    orientation === "vertical" ? VERTICAL_STACK_STYLE : HORIZONTAL_GRID_STYLE;

  return (
    <div
      data-testid="statbadge"
      data-orientation={orientation}
      data-winner={winner}
      role="group"
      aria-label={ariaLabel}
      style={{
        ...BADGE_BASE_STYLE,
        ...(styles?.chrome?.backgroundColor != null
          ? { background: styles.chrome.backgroundColor }
          : {}),
      }}
    >
      <div style={bodyStyle}>
        {orientation === "horizontal" ? (
          <>
            <span
              data-testid="statbadge-home-value"
              style={{
                ...valueStyle("home", winner, theme.text, styles?.home),
                textAlign: "left",
              }}
            >
              {homeText}
            </span>
            <span
              data-testid="statbadge-label"
              style={labelStyle(styles?.label?.color ?? theme.text.secondary)}
            >
              {stat.label}
            </span>
            <span
              data-testid="statbadge-away-value"
              style={{
                ...valueStyle("away", winner, theme.text, styles?.away),
                textAlign: "right",
              }}
            >
              {awayText}
            </span>
          </>
        ) : (
          <>
            <span
              data-testid="statbadge-home-value"
              style={{
                ...valueStyle("home", winner, theme.text, styles?.home),
                textAlign: "center",
              }}
            >
              {homeText}
            </span>
            <span
              data-testid="statbadge-label"
              style={labelStyle(styles?.label?.color ?? theme.text.secondary)}
            >
              {stat.label}
            </span>
            <span
              data-testid="statbadge-away-value"
              style={{
                ...valueStyle("away", winner, theme.text, styles?.away),
                textAlign: "center",
              }}
            >
              {awayText}
            </span>
          </>
        )}
      </div>
      {bar != null ? (
        <div
          data-testid="statbadge-bar"
          data-degenerate={bar.degenerate ? "true" : "false"}
          role="presentation"
          style={{
            ...barTrackStyle(styles?.bar?.trackColor ?? theme.border.subtle),
            opacity: bar.degenerate ? 0.4 : 1,
          }}
        >
          <div
            data-testid="statbadge-bar-home"
            style={{
              width: `${bar.home * 100}%`,
              background: styles?.home?.barColor ?? DEFAULT_HOME_COLOR,
              transition: "width 240ms ease",
            }}
          />
          <div
            data-testid="statbadge-bar-away"
            style={{
              width: `${bar.away * 100}%`,
              background: styles?.away?.barColor ?? DEFAULT_AWAY_COLOR,
              transition: "width 240ms ease",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

const ROW_BASE_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem 1.25rem",
  width: "100%",
};

const ROW_VERTICAL_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.75rem",
  width: "100%",
};

/**
 * StatBadgeRow — horizontal strip of `StatBadge`s for the broadcast-style
 * match header. Pass an array of pre-formatted stats; the row handles
 * layout, equal widths, responsive collapse, and accessibility.
 *
 * Empty `stats` arrays render an empty section with `data-empty="true"`
 * rather than crashing — consumers can decide whether to hide the row.
 */
export function StatBadgeRow(props: StatBadgeRowProps): ReactElement {
  const {
    stats,
    styles,
    orientation = "horizontal",
    ariaLabel = DEFAULT_ARIA_LABEL,
  } = props;

  const isEmpty = !Array.isArray(stats) || stats.length === 0;
  const rowStyle = orientation === "vertical" ? ROW_VERTICAL_STYLE : ROW_BASE_STYLE;

  return (
    <section
      data-testid="statbadge-row"
      data-orientation={orientation}
      {...(isEmpty ? { "data-empty": "true" } : {})}
      role="region"
      aria-label={ariaLabel}
      style={rowStyle}
    >
      {isEmpty
        ? null
        : stats.map((stat, index) => (
            <StatBadge
              // Stat labels are typically unique within a row, but fall back
              // to the index for the rare degenerate case.
              key={`${stat.label}-${index}`}
              stat={stat}
              {...(styles != null ? { styles } : {})}
              orientation={orientation}
            />
          ))}
    </section>
  );
}
