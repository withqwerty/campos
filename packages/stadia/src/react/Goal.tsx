import { useMemo, type ReactNode, type CSSProperties } from "react";

import { GOAL } from "../geometry/constants.js";
import {
  createGoalProjection,
  type GoalFacing,
  type GoalProjectFn,
} from "../transforms/goal-transform.js";
import { computeViewBox } from "../transforms/viewbox.js";
import { resolveGoalColors, type GoalColors, type Theme } from "./theme.js";
import { GoalFrame } from "./GoalFrame.js";

/**
 * Extra viewBox breathing room, expressed as a percentage of goal width
 * ({@link GOAL.width} = 7.32 m). `10` means ~0.73 m of padding on that edge —
 * about one marker radius. Use this when shot markers, ground-line extensions,
 * or annotations should extend beyond the bare goal frame.
 */
export type GoalPadding =
  | number
  | { top: number; right: number; bottom: number; left: number };

const GOAL_PROJECT_BAR_THICKNESS = GOAL.depth * 0.033;
const GOAL_PROJECT_GROUND_EXTENSION = GOAL.width * 0.35;
const GOAL_PROJECT_NET_COLUMNS = 8;
const GOAL_PROJECT_NET_ROWS = 4;
const GOAL_PROJECT_NET_THICKNESS = GOAL.depth * 0.012;
const GOAL_PROJECT_GROUND_THICKNESS = GOAL.depth * 0.016;
const GOAL_PROJECT_NET_BACK_INSET = GOAL.width * 0.1;
const GOAL_PROJECT_NET_BACK_OFFSET_TOP = GOAL.depth * 0.16;
const GOAL_PROJECT_NET_BACK_OFFSET_BOTTOM = GOAL.depth * 0.24;

export type GoalProps = {
  /** Viewer perspective. `striker` keeps left post on screen-left; `goalkeeper` mirrors horizontally. */
  facing: GoalFacing;
  /** Built-in goal color preset. */
  theme?: Theme;
  /** Per-color overrides applied after the selected theme. */
  colors?: GoalColors;
  /** Net rendering density. `none` leaves only the frame and ground line. */
  netStyle?: "none" | "light" | "dense";
  /** Net geometry. `box` adds a recessed back frame and side panels inside the mouth. */
  netShape?: "flat" | "box";
  /** Width inset of the recessed back frame, in SVG user units. Ignored when `netShape="flat"`. */
  netBackInset?: number;
  /** Vertical offset of the recessed back crossbar, in SVG user units. Ignored when `netShape="flat"`. */
  netBackOffsetTop?: number;
  /** Upward lift of the recessed back ground line, in SVG user units. Ignored when `netShape="flat"`. */
  netBackOffsetBottom?: number;
  /** Net opacity from 0 to 1. */
  netOpacity?: number;
  /** Number of vertical net divisions. */
  netColumns?: number;
  /** Number of horizontal net divisions. */
  netRows?: number;
  /** Stroke width for net lines, in SVG user units. */
  netThickness?: number;
  /** How far the ground line extends beyond each post, in SVG user units. */
  groundExtension?: number;
  /** Stroke width for the ground line, in SVG user units. */
  groundThickness?: number;
  /** Stroke width for posts and crossbar, in SVG user units. */
  barThickness?: number;
  /** Extra viewBox padding around the goal frame. Numeric values are percentages of goal width. */
  padding?: GoalPadding;
  /** Set `false` for static export snapshots or when a parent owns interaction. */
  interactive?: boolean;
  /** Optional class name applied to the outer SVG. */
  className?: string;
  /** Optional inline styles merged after Stadia's responsive SVG sizing. */
  style?: CSSProperties;
  /** Optional ARIA role applied to the outer <svg>; set to "img" for standalone goal charts. */
  role?: string;
  /** Optional accessible label applied to the outer <svg> when it is treated as an image/chart. */
  ariaLabel?: string;
  /**
   * Foreground SVG marks rendered above the goal frame. The `project` callback
   * maps goal-mouth Y/Z 0..100 coordinates to SVG meter-scale user units.
   */
  children: (ctx: { project: GoalProjectFn }) => ReactNode;
};

export function Goal({
  facing,
  theme = "primary",
  colors: colorOverrides,
  netStyle = "light",
  netShape = "box",
  netBackInset = GOAL_PROJECT_NET_BACK_INSET,
  netBackOffsetTop = GOAL_PROJECT_NET_BACK_OFFSET_TOP,
  netBackOffsetBottom = GOAL_PROJECT_NET_BACK_OFFSET_BOTTOM,
  netOpacity = 0.45,
  netColumns = GOAL_PROJECT_NET_COLUMNS,
  netRows = GOAL_PROJECT_NET_ROWS,
  netThickness = GOAL_PROJECT_NET_THICKNESS,
  groundExtension = GOAL_PROJECT_GROUND_EXTENSION,
  groundThickness = GOAL_PROJECT_GROUND_THICKNESS,
  barThickness = GOAL_PROJECT_BAR_THICKNESS,
  padding,
  interactive = true,
  className,
  style,
  role,
  ariaLabel,
  children,
}: GoalProps) {
  const project = useMemo(
    () => createGoalProjection(facing, { frameThickness: barThickness }),
    [facing, barThickness],
  );

  const viewBox = useMemo(() => computeViewBox("goal", "up", padding), [padding]);

  const colors = useMemo(
    () => resolveGoalColors(theme, colorOverrides),
    [theme, colorOverrides],
  );

  const aspectRatio = `${viewBox.width} / ${viewBox.height}`;
  const vbString = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

  return (
    <svg
      viewBox={vbString}
      overflow="hidden"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      {...(role != null ? { role } : {})}
      {...(ariaLabel != null ? { "aria-label": ariaLabel } : {})}
      style={{
        width: "100%",
        aspectRatio,
        display: "block",
        ...(interactive ? {} : { pointerEvents: "none" as const }),
        ...style,
      }}
    >
      <GoalFrame
        colors={colors}
        netStyle={netStyle}
        netShape={netShape}
        netBackInset={netBackInset}
        netBackOffsetTop={netBackOffsetTop}
        netBackOffsetBottom={netBackOffsetBottom}
        netOpacity={netOpacity}
        netColumns={netColumns}
        netRows={netRows}
        netThickness={netThickness}
        groundExtension={groundExtension}
        groundThickness={groundThickness}
        barThickness={barThickness}
      />
      {children({ project })}
    </svg>
  );
}
