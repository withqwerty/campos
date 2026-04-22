import type { Shot } from "@withqwerty/campos-schema";
import { max as d3Max } from "d3-array";

import {
  applyAxisPadding,
  type AxisPaddingInput,
  DEFAULT_AXIS_PADDING,
  resolveAxisPadding,
} from "./scales/axis-padding.js";
import { createContinuousScale } from "./scales/continuous-scale.js";
import { createNumericAxis } from "./scales/numeric-axis.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type XGTimelineStepPoint = {
  /** Linear minute (minute + addedMinute folded in). */
  minute: number;
  /** Cumulative xG at this point. */
  cumXg: number;
  /** SVG x-coordinate (includes margin offset). */
  cx: number;
  /** SVG y-coordinate (includes margin offset). */
  cy: number;
};

export type XGTimelineStepLineModel = {
  teamId: string;
  teamLabel: string;
  color: string;
  /** Pre-computed SVG step-after path string (M/H/V segments). */
  path: string;
  /** Ordered step points for hit-testing / tooltips. */
  points: XGTimelineStepPoint[];
  /** Final cumulative xG value. */
  totalXg: number;
};

export type XGTimelineAreaSegment = {
  /** SVG path for the filled region. */
  path: string;
  /** Fill color (leading team's color, or team color in mirrored mode). */
  fill: string;
  /** Opacity for the area fill. */
  opacity: number;
};

export type XGTimelineMarkerModel = {
  id: string;
  teamId: string;
  /** SVG x-coordinate. */
  cx: number;
  /** SVG y-coordinate. */
  cy: number;
  /** Circle radius in px. */
  r: number;
  fill: string;
  stroke: string;
  /** Annotation tier: 1 = goal (always shown), 2 = high xG non-goal, 3 = tooltip-only. */
  tier: 1 | 2 | 3;
  /** Whether this shot was a goal. */
  isGoal: boolean;
  /** Player name for tooltip/annotation. */
  playerName: string | null;
  /** xG value for tooltip/annotation. */
  xg: number;
  /** Linear minute for tooltip/annotation. */
  minute: number;
  outcome: Shot["outcome"];
};

export type XGTimelineAnnotationModel = {
  /** Reference marker id. */
  markerId: string;
  /** Annotation text (e.g. "Salah 0.72"). */
  text: string;
  /** SVG x-coordinate for label. */
  x: number;
  /** SVG y-coordinate for label. */
  y: number;
  textAnchor: "start" | "middle" | "end";
};

export type XGTimelineEndLabelModel = {
  teamId: string;
  teamLabel: string;
  /** Formatted total xG string (e.g. "2.41"). */
  text: string;
  /** SVG x-coordinate (right edge). */
  x: number;
  /** SVG y-coordinate (adjusted for overlap avoidance). */
  y: number;
  color: string;
};

export type XGTimelineGuideModel = {
  /** Label displayed on the guide (e.g. "HT", "FT"). */
  label: string;
  /** Linear minute position. */
  minute: number;
  /** SVG x-coordinate. */
  x: number;
  /** SVG y1 (top of plot area). */
  y1: number;
  /** SVG y2 (bottom of plot area). */
  y2: number;
};

export type XGTimelineScoreStripSegment = {
  /** Running scoreline text (e.g. "1 - 0"). */
  label: string;
  /** SVG x start. */
  x1: number;
  /** SVG x end. */
  x2: number;
  /** SVG y position. */
  y: number;
  /** Height of the strip segment. */
  height: number;
  /** Fill color of the scoring team. */
  fill: string;
};

export type XGTimelineBackgroundBand = {
  /** SVG x start. */
  x: number;
  /** SVG y start. */
  y: number;
  /** SVG width. */
  width: number;
  /** SVG height. */
  height: number;
  /** Fill color/pattern. */
  fill: string;
  /** Opacity. */
  opacity: number;
  /** Label (e.g. "ET"). */
  label: string | null;
};

export type XGTimelineAxisModel = {
  x: {
    label: string;
    domain: [number, number];
    ticks: number[];
  };
  y: {
    label: string;
    domain: [number, number];
    ticks: number[];
  };
};

export type XGTimelineModel = {
  meta: {
    component: "XGTimeline";
    empty: boolean;
    totalShots: number;
    validShots: number;
    warnings: string[];
    accessibleLabel: string;
  };
  layout: {
    viewBox: { width: number; height: number };
    plotArea: { x: number; y: number; width: number; height: number };
    frame: { x: number; y: number; width: number; height: number };
  };
  axes: XGTimelineAxisModel;
  stepLines: XGTimelineStepLineModel[];
  areaSegments: XGTimelineAreaSegment[];
  markers: XGTimelineMarkerModel[];
  annotations: XGTimelineAnnotationModel[];
  endLabels: XGTimelineEndLabelModel[];
  guides: XGTimelineGuideModel[];
  scoreStrip: XGTimelineScoreStripSegment[];
  backgroundBands: XGTimelineBackgroundBand[];
  emptyState: { message: string } | null;
};

export type ComputeXGTimelineInput = {
  shots: readonly Shot[];
  homeTeam: string;
  awayTeam: string;
  layout?: "ascending" | "mirrored";
  showAreaFill?: boolean;
  showScoreStrip?: boolean;
  showShotDots?: boolean;
  showCrosshair?: boolean;
  teamColors?: readonly [string, string];
  /**
   * Pixel gutter between plot rect and axis lines. Default `[0, 6]` — no
   * x-gutter (the timeline is bound by match-clock compression bands) but
   * a y-gutter so the top and bottom score-strip markers don't clip.
   */
  axisPadding?: AxisPaddingInput;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWBOX_W = 560;
const VIEWBOX_H = 320;
const MARGIN = { top: 20, right: 60, bottom: 40, left: 50 };
const PLOT_W = VIEWBOX_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

const DEFAULT_HOME_COLOR = "#c8102e";
const DEFAULT_AWAY_COLOR = "#1d428a";

const TIER_2_XG_THRESHOLD = 0.3;
const GOAL_MARKER_R = 4;
const SHOT_MARKER_R = 2;
const SCORE_STRIP_GAP = 20;

/** Minimum pixel gap between end labels to avoid overlap. */
const END_LABEL_MIN_GAP = 12;

/** Max tier-2 annotations per 15-minute window. */
const TIER_2_MAX_PER_WINDOW = 3;

const AREA_FILL_OPACITY = 0.15;
const STOPPAGE_BAND_FILL = "rgba(0,0,0,0.04)";
const ET_BAND_FILL = "rgba(0,0,0,0.06)";
const SCORE_STRIP_HEIGHT = 14;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a shot has valid data for the xG timeline. */
function isValidShot(shot: Shot): boolean {
  return (
    typeof shot.xg === "number" &&
    Number.isFinite(shot.xg) &&
    typeof shot.teamId === "string" &&
    shot.teamId.length > 0 &&
    typeof shot.minute === "number" &&
    Number.isFinite(shot.minute)
  );
}

/** Fold addedMinute into a linear minute for continuous x-axis. */
function linearMinute(shot: Shot): number {
  const base = shot.minute;
  const added =
    typeof shot.addedMinute === "number" && Number.isFinite(shot.addedMinute)
      ? shot.addedMinute
      : 0;
  return base + added;
}

/** Sort comparator: period → minute → second. */
function shotSortComparator(a: Shot, b: Shot): number {
  if (a.period !== b.period) return a.period - b.period;
  const aMin = linearMinute(a);
  const bMin = linearMinute(b);
  if (aMin !== bMin) return aMin - bMin;
  return a.second - b.second;
}

/** Determine match end minute from shot data. */
function determineEndMinute(shots: readonly Shot[]): number {
  let maxMinute = 90;
  let hasExtraTime = false;

  for (const shot of shots) {
    const lm = linearMinute(shot);
    if (lm > maxMinute) maxMinute = lm;
    if (shot.period === 3 || shot.period === 4) hasExtraTime = true;
  }

  if (hasExtraTime) {
    return Math.max(120, maxMinute);
  }
  return Math.max(90, maxMinute);
}

/** Build step-after SVG path from points. H first (horizontal), then V (vertical). */
function buildStepAfterPath(points: XGTimelineStepPoint[]): string {
  if (points.length === 0) return "";
  const first = points[0] as XGTimelineStepPoint;
  const parts: string[] = [`M ${round(first.cx)} ${round(first.cy)}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1] as XGTimelineStepPoint;
    const curr = points[i] as XGTimelineStepPoint;
    // Step-after: hold previous value horizontally, then jump vertically
    if (curr.cx !== prev.cx) {
      parts.push(`H ${round(curr.cx)}`);
    }
    if (curr.cy !== prev.cy) {
      parts.push(`V ${round(curr.cy)}`);
    }
  }
  return parts.join(" ");
}

/** Round to 2 decimal places to keep SVG paths readable. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function scoreStripFill(
  homeGoals: number,
  awayGoals: number,
  homeColor: string,
  awayColor: string,
): string {
  if (homeGoals > awayGoals) return homeColor;
  if (awayGoals > homeGoals) return awayColor;
  return "transparent";
}

/** Format xG value for display. */
function formatXg(xg: number): string {
  return xg.toFixed(2);
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computeXGTimeline(input: ComputeXGTimelineInput): XGTimelineModel {
  const {
    shots,
    homeTeam,
    awayTeam,
    layout = "ascending",
    showAreaFill = true,
    showScoreStrip = false,
    showShotDots = true,
    // showCrosshair is consumed by renderer, not core
    teamColors,
    axisPadding = [0, DEFAULT_AXIS_PADDING] as const,
  } = input;
  const [gutterX, gutterY] = resolveAxisPadding(axisPadding);
  const frame = { x: MARGIN.left, y: MARGIN.top, width: PLOT_W, height: PLOT_H };
  const plotArea = applyAxisPadding(frame, [gutterX, gutterY]);

  const warnings: string[] = [];
  const totalShots = shots.length;

  // ---- validate shots -------------------------------------------------------
  const validShots = shots.filter(isValidShot);
  const excludedCount = totalShots - validShots.length;

  if (excludedCount > 0) {
    warnings.push(`${excludedCount} shot(s) excluded: missing xg, teamId, or minute`);
  }

  if (validShots.length === 0) {
    return emptyModel(totalShots, warnings);
  }

  // ---- sort by period → minute → second ------------------------------------
  const sorted = [...validShots].sort(shotSortComparator);

  // ---- identify teams -------------------------------------------------------
  const homeColor = teamColors?.[0] ?? DEFAULT_HOME_COLOR;
  const awayColor = teamColors?.[1] ?? DEFAULT_AWAY_COLOR;

  // ---- determine end minute -------------------------------------------------
  const endMinute = determineEndMinute(sorted);
  const hasExtraTime = endMinute > 90;

  // ---- x-axis ---------------------------------------------------------------
  const xTicks: number[] = [];
  for (let t = 0; t <= endMinute; t += 15) {
    xTicks.push(t);
  }
  // Ensure endMinute is included if not already a tick
  if (xTicks[xTicks.length - 1] !== endMinute) {
    xTicks.push(endMinute);
  }

  const xScale = createContinuousScale({
    kind: "linear",
    domain: [0, endMinute],
    range: [gutterX, PLOT_W - gutterX],
  });

  // ---- compute cumulative xG per team ---------------------------------------
  type CumEntry = { minute: number; cumXg: number; shot: Shot };
  const homeEntries: CumEntry[] = [];
  const awayEntries: CumEntry[] = [];

  let homeCum = 0;
  let awayCum = 0;

  const unknownTeamIds = new Set<string>();
  for (const shot of sorted) {
    const lm = linearMinute(shot);
    const xg = shot.xg as number; // validated in isValidShot
    if (shot.teamId === homeTeam) {
      homeCum += xg;
      homeEntries.push({ minute: lm, cumXg: homeCum, shot });
    } else if (shot.teamId === awayTeam) {
      awayCum += xg;
      awayEntries.push({ minute: lm, cumXg: awayCum, shot });
    } else {
      unknownTeamIds.add(shot.teamId);
    }
  }

  if (unknownTeamIds.size > 0) {
    const sample = [...unknownTeamIds].slice(0, 3).join(", ");
    const suffix = unknownTeamIds.size > 3 ? `, +${unknownTeamIds.size - 3} more` : "";
    warnings.push(
      `${unknownTeamIds.size} shot teamId(s) matched neither homeTeam ("${homeTeam}") nor awayTeam ("${awayTeam}") and were dropped: ${sample}${suffix}`,
    );
  }

  // ---- y-axis ---------------------------------------------------------------
  const maxCumXg = Math.max(homeCum, awayCum, 0.1); // avoid 0-height
  const isMirrored = layout === "mirrored";

  // Mirrored: y-axis spans [-max, +max] so home goes up, away goes down.
  // Ascending: y-axis spans [0, max].
  const yAxis = createNumericAxis({
    min: isMirrored ? -maxCumXg : 0,
    max: maxCumXg,
    range: [gutterY, PLOT_H - gutterY],
    tickCount: isMirrored ? 6 : 5,
    invert: true,
  });
  const yScale = yAxis.scale;

  // ---- build step points ----------------------------------------------------
  /**
   * @param ySign — 1 for home (ascending up), -1 for away in mirrored mode (descending down)
   */
  function buildStepPoints(
    entries: CumEntry[],
    finalCum: number,
    ySign: 1 | -1,
  ): XGTimelineStepPoint[] {
    const points: XGTimelineStepPoint[] = [];

    // Start at (0, 0)
    points.push({
      minute: 0,
      cumXg: 0,
      cx: MARGIN.left + xScale(0),
      cy: MARGIN.top + yScale(0),
    });

    for (const entry of entries) {
      // Step-after: first add point at new minute with OLD cumXg (horizontal),
      // then at new minute with NEW cumXg (vertical).
      const prevCum = (points[points.length - 1] as XGTimelineStepPoint).cumXg;
      // Horizontal segment to this minute
      points.push({
        minute: entry.minute,
        cumXg: prevCum,
        cx: MARGIN.left + xScale(entry.minute),
        cy: MARGIN.top + yScale(prevCum * ySign),
      });
      // Vertical jump to new cumXg
      points.push({
        minute: entry.minute,
        cumXg: entry.cumXg,
        cx: MARGIN.left + xScale(entry.minute),
        cy: MARGIN.top + yScale(entry.cumXg * ySign),
      });
    }

    // End at (endMinute, finalCum)
    points.push({
      minute: endMinute,
      cumXg: finalCum,
      cx: MARGIN.left + xScale(endMinute),
      cy: MARGIN.top + yScale(finalCum * ySign),
    });

    return points;
  }

  const homePoints = buildStepPoints(homeEntries, homeCum, 1);
  const awayPoints = buildStepPoints(awayEntries, awayCum, isMirrored ? -1 : 1);

  const stepLines: XGTimelineStepLineModel[] = [
    {
      teamId: homeTeam,
      teamLabel: homeTeam,
      color: homeColor,
      path: buildStepAfterPath(homePoints),
      points: homePoints,
      totalXg: homeCum,
    },
    {
      teamId: awayTeam,
      teamLabel: awayTeam,
      color: awayColor,
      path: buildStepAfterPath(awayPoints),
      points: awayPoints,
      totalXg: awayCum,
    },
  ];

  // ---- area fill segments ---------------------------------------------------
  const areaSegments: XGTimelineAreaSegment[] = [];

  if (showAreaFill) {
    if (layout === "mirrored") {
      // Mirrored: fill from zero-line to each team's line
      areaSegments.push(
        buildAreaFromZero(homePoints, homeColor, yScale),
        buildAreaFromZero(awayPoints, awayColor, yScale),
      );
    } else {
      // Ascending: fill between the two lines with leading team's color
      const betweenSegments = buildAreaBetween(
        homePoints,
        awayPoints,
        homeColor,
        awayColor,
      );
      areaSegments.push(...betweenSegments);
    }
  }

  // ---- markers --------------------------------------------------------------
  const markers: XGTimelineMarkerModel[] = [];

  {
    // Always build markers — goals are always visible, showShotDots controls tier 3 only
    const allShotEntries = [
      ...homeEntries.map((e) => ({ ...e, teamId: homeTeam, color: homeColor })),
      ...awayEntries.map((e) => ({ ...e, teamId: awayTeam, color: awayColor })),
    ].sort((a, b) => shotSortComparator(a.shot, b.shot));

    // Count tier-2 annotations per 15-min window
    const tier2Counts = new Map<number, number>();

    for (const entry of allShotEntries) {
      const isGoal = entry.shot.outcome === "goal";
      const xg = entry.shot.xg as number;
      const window = Math.floor(entry.minute / 15);

      let tier: 1 | 2 | 3;
      if (isGoal) {
        tier = 1;
      } else if (xg >= TIER_2_XG_THRESHOLD) {
        const currentCount = tier2Counts.get(window) ?? 0;
        if (currentCount < TIER_2_MAX_PER_WINDOW) {
          tier = 2;
          tier2Counts.set(window, currentCount + 1);
        } else {
          tier = 3;
        }
      } else {
        tier = 3;
      }

      // Skip tier-3 dots when showShotDots is off — goals and tier-2 always visible
      if (tier === 3 && !showShotDots) continue;

      const isAway = entry.teamId === awayTeam;
      const markerYSign = isMirrored && isAway ? -1 : 1;

      markers.push({
        id: entry.shot.id,
        teamId: entry.teamId,
        cx: MARGIN.left + xScale(entry.minute),
        cy: MARGIN.top + yScale(entry.cumXg * markerYSign),
        r: isGoal ? GOAL_MARKER_R : SHOT_MARKER_R,
        fill: isGoal ? entry.color : "transparent",
        stroke: entry.color,
        tier,
        isGoal,
        playerName: entry.shot.playerName,
        xg,
        minute: entry.minute,
        outcome: entry.shot.outcome,
      });
    }
  }

  // ---- annotations (tier 1 and 2 markers) -----------------------------------
  const annotations: XGTimelineAnnotationModel[] = [];
  const annotatedMarkers = markers.filter((m) => m.tier === 1 || m.tier === 2);

  for (const marker of annotatedMarkers) {
    const name = marker.playerName ?? "";
    const label = marker.isGoal ? `${name} ${formatXg(marker.xg)}` : formatXg(marker.xg);

    // Position annotation above the marker (ascending), or below for away team in mirrored
    const isAwayMirrored = isMirrored && marker.teamId === awayTeam;
    const yOffset = isAwayMirrored ? 14 : -8;
    const annotationY = marker.cy + yOffset;

    // Determine text anchor based on x position
    let textAnchor: "start" | "middle" | "end" = "middle";
    const plotRight = MARGIN.left + PLOT_W;
    if (marker.cx < MARGIN.left + 40) {
      textAnchor = "start";
    } else if (marker.cx > plotRight - 40) {
      textAnchor = "end";
    }

    annotations.push({
      markerId: marker.id,
      text: label.trim(),
      x: marker.cx,
      y: annotationY,
      textAnchor,
    });
  }

  // ---- end labels -----------------------------------------------------------
  const endLabelX = MARGIN.left + PLOT_W + 8;

  let homeEndY = MARGIN.top + yScale(homeCum);
  let awayEndY = MARGIN.top + yScale(isMirrored ? -awayCum : awayCum);

  // Overlap avoidance: push apart if too close
  if (Math.abs(homeEndY - awayEndY) < END_LABEL_MIN_GAP) {
    const midY = (homeEndY + awayEndY) / 2;
    if (homeCum >= awayCum) {
      homeEndY = midY - END_LABEL_MIN_GAP / 2;
      awayEndY = midY + END_LABEL_MIN_GAP / 2;
    } else {
      homeEndY = midY + END_LABEL_MIN_GAP / 2;
      awayEndY = midY - END_LABEL_MIN_GAP / 2;
    }
  }

  const endLabels: XGTimelineEndLabelModel[] = [
    {
      teamId: homeTeam,
      teamLabel: homeTeam,
      text: formatXg(homeCum),
      x: endLabelX,
      y: homeEndY,
      color: homeColor,
    },
    {
      teamId: awayTeam,
      teamLabel: awayTeam,
      text: formatXg(awayCum),
      x: endLabelX,
      y: awayEndY,
      color: awayColor,
    },
  ];

  // ---- time guides ----------------------------------------------------------
  const guides: XGTimelineGuideModel[] = [];
  const plotTop = MARGIN.top;
  const plotBottom = MARGIN.top + PLOT_H;

  // Always show HT (45') and FT (90')
  guides.push({
    label: "HT",
    minute: 45,
    x: MARGIN.left + xScale(45),
    y1: plotTop,
    y2: plotBottom,
  });

  if (endMinute >= 90) {
    guides.push({
      label: "FT",
      minute: 90,
      x: MARGIN.left + xScale(90),
      y1: plotTop,
      y2: plotBottom,
    });
  }

  if (hasExtraTime) {
    if (endMinute >= 105) {
      guides.push({
        label: "ET HT",
        minute: 105,
        x: MARGIN.left + xScale(105),
        y1: plotTop,
        y2: plotBottom,
      });
    }
    if (endMinute >= 120) {
      guides.push({
        label: "ET FT",
        minute: 120,
        x: MARGIN.left + xScale(120),
        y1: plotTop,
        y2: plotBottom,
      });
    }
  }

  // ---- score strip ----------------------------------------------------------
  const scoreStrip: XGTimelineScoreStripSegment[] = [];

  if (showScoreStrip) {
    const goals = sorted.filter((s) => s.outcome === "goal");
    let homeGoals = 0;
    let awayGoals = 0;
    let prevX = MARGIN.left + xScale(0);
    const stripY = MARGIN.top + PLOT_H + SCORE_STRIP_GAP; // Below the x-axis

    for (const goal of goals) {
      const lm = linearMinute(goal);
      const goalX = MARGIN.left + xScale(lm);
      const isHome = goal.teamId === homeTeam;

      // Segment before this goal
      if (goalX > prevX) {
        scoreStrip.push({
          label: `${homeGoals} - ${awayGoals}`,
          x1: prevX,
          x2: goalX,
          y: stripY,
          height: SCORE_STRIP_HEIGHT,
          fill: scoreStripFill(homeGoals, awayGoals, homeColor, awayColor),
        });
      }

      if (isHome) homeGoals++;
      else awayGoals++;

      prevX = goalX;
    }

    // Final segment to end
    const endX = MARGIN.left + xScale(endMinute);
    scoreStrip.push({
      label: `${homeGoals} - ${awayGoals}`,
      x1: prevX,
      x2: endX,
      y: stripY,
      height: SCORE_STRIP_HEIGHT,
      fill: scoreStripFill(homeGoals, awayGoals, homeColor, awayColor),
    });
  }

  // ---- background bands -----------------------------------------------------
  const backgroundBands: XGTimelineBackgroundBand[] = [];

  // Stoppage-time zones: 45+ and 90+ regions
  // Find max linear minute in each half to detect stoppage time
  const maxFirstHalf =
    d3Max(
      sorted.filter((s) => s.period === 1),
      linearMinute,
    ) ?? 0;
  const maxSecondHalf =
    d3Max(
      sorted.filter((s) => s.period === 2),
      linearMinute,
    ) ?? 0;

  if (maxFirstHalf > 45) {
    backgroundBands.push({
      x: MARGIN.left + xScale(45),
      y: plotTop,
      width: xScale(maxFirstHalf) - xScale(45),
      height: PLOT_H,
      fill: STOPPAGE_BAND_FILL,
      opacity: 1,
      label: null,
    });
  }

  if (maxSecondHalf > 90) {
    backgroundBands.push({
      x: MARGIN.left + xScale(90),
      y: plotTop,
      width: xScale(maxSecondHalf) - xScale(90),
      height: PLOT_H,
      fill: STOPPAGE_BAND_FILL,
      opacity: 1,
      label: null,
    });
  }

  // Extra-time shading
  if (hasExtraTime) {
    backgroundBands.push({
      x: MARGIN.left + xScale(90),
      y: plotTop,
      width: xScale(endMinute) - xScale(90),
      height: PLOT_H,
      fill: ET_BAND_FILL,
      opacity: 1,
      label: "ET",
    });
  }

  // ---- accessible label -----------------------------------------------------
  const homeGoalCount = homeEntries.filter((e) => e.shot.outcome === "goal").length;
  const awayGoalCount = awayEntries.filter((e) => e.shot.outcome === "goal").length;
  const accessibleLabel =
    `xG timeline: ${homeTeam} ${formatXg(homeCum)} xG (${homeGoalCount} goals) ` +
    `vs ${awayTeam} ${formatXg(awayCum)} xG (${awayGoalCount} goals)`;

  return {
    meta: {
      component: "XGTimeline",
      empty: false,
      totalShots,
      validShots: validShots.length,
      warnings,
      accessibleLabel,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea,
      frame,
    },
    axes: {
      x: {
        label: "Minute",
        domain: [0, endMinute],
        ticks: xTicks,
      },
      y: {
        label: "Cumulative xG",
        domain: yAxis.domain,
        ticks: yAxis.ticks,
      },
    },
    stepLines,
    areaSegments,
    markers,
    annotations,
    endLabels,
    guides,
    scoreStrip,
    backgroundBands,
    emptyState: null,
  };
}

// ---------------------------------------------------------------------------
// Area fill helpers
// ---------------------------------------------------------------------------

/** Build area path from zero-line to step line (mirrored mode). */
function buildAreaFromZero(
  points: XGTimelineStepPoint[],
  color: string,
  yScale: (v: number) => number,
): XGTimelineAreaSegment {
  if (points.length === 0) {
    return { path: "", fill: color, opacity: AREA_FILL_OPACITY };
  }

  const zeroY = MARGIN.top + yScale(0);
  const first = points[0] as XGTimelineStepPoint;
  const last = points[points.length - 1] as XGTimelineStepPoint;

  // Forward path along the step line
  let path = `M ${round(first.cx)} ${round(zeroY)}`;
  path += ` L ${round(first.cx)} ${round(first.cy)}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1] as XGTimelineStepPoint;
    const curr = points[i] as XGTimelineStepPoint;
    if (curr.cx !== prev.cx) {
      path += ` H ${round(curr.cx)}`;
    }
    if (curr.cy !== prev.cy) {
      path += ` V ${round(curr.cy)}`;
    }
  }

  // Close back to zero-line
  path += ` L ${round(last.cx)} ${round(zeroY)}`;
  path += " Z";

  return { path, fill: color, opacity: AREA_FILL_OPACITY };
}

/**
 * Build area segments between two step lines (ascending mode).
 * Fills between the lines with the leading team's color.
 *
 * Simplified: builds one segment for each team based on which line is higher
 * at the final value. For a more precise per-crossing implementation, this
 * would need line intersection detection. This is a practical first pass.
 */
function buildAreaBetween(
  homePoints: XGTimelineStepPoint[],
  awayPoints: XGTimelineStepPoint[],
  homeColor: string,
  awayColor: string,
): XGTimelineAreaSegment[] {
  if (homePoints.length === 0 || awayPoints.length === 0) return [];

  // Build a combined area between the two lines
  const homeLast = homePoints[homePoints.length - 1] as XGTimelineStepPoint;
  const awayLast = awayPoints[awayPoints.length - 1] as XGTimelineStepPoint;

  // Determine which team is leading (or equal)
  const leadColor = homeLast.cumXg >= awayLast.cumXg ? homeColor : awayColor;

  // Forward path along home line
  let path = "";
  const first = homePoints[0] as XGTimelineStepPoint;
  path += `M ${round(first.cx)} ${round(first.cy)}`;

  for (let i = 1; i < homePoints.length; i++) {
    const prev = homePoints[i - 1] as XGTimelineStepPoint;
    const curr = homePoints[i] as XGTimelineStepPoint;
    if (curr.cx !== prev.cx) path += ` H ${round(curr.cx)}`;
    if (curr.cy !== prev.cy) path += ` V ${round(curr.cy)}`;
  }

  // Reverse path along away line
  for (let i = awayPoints.length - 1; i >= 0; i--) {
    const curr = awayPoints[i] as XGTimelineStepPoint;
    if (i === awayPoints.length - 1) {
      path += ` L ${round(curr.cx)} ${round(curr.cy)}`;
    } else {
      const next = awayPoints[i + 1] as XGTimelineStepPoint;
      if (curr.cy !== next.cy) path += ` V ${round(curr.cy)}`;
      if (curr.cx !== next.cx) path += ` H ${round(curr.cx)}`;
    }
  }

  path += " Z";

  return [{ path, fill: leadColor, opacity: AREA_FILL_OPACITY }];
}

// ---------------------------------------------------------------------------
// Empty model
// ---------------------------------------------------------------------------

function emptyModel(totalShots: number, warnings: string[]): XGTimelineModel {
  const emptyFrame = { x: MARGIN.left, y: MARGIN.top, width: PLOT_W, height: PLOT_H };
  return {
    meta: {
      component: "XGTimeline",
      empty: true,
      totalShots,
      validShots: 0,
      warnings,
      accessibleLabel: "xG timeline: no shot data",
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea: emptyFrame,
      frame: emptyFrame,
    },
    axes: {
      x: { label: "Minute", domain: [0, 90], ticks: [0, 15, 30, 45, 60, 75, 90] },
      y: { label: "Cumulative xG", domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    },
    stepLines: [],
    areaSegments: [],
    markers: [],
    annotations: [],
    endLabels: [],
    guides: [],
    scoreStrip: [],
    backgroundBands: [],
    emptyState: { message: "No shot data" },
  };
}
