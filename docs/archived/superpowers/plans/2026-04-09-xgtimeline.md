# XGTimeline Implementation Plan

**Status:** archived
**Superseded by:** `docs/specs/xgtimeline-spec.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the XGTimeline component — a cumulative xG step chart showing match narrative over time, with area fill, goal annotations, score strip, crosshair, and extra-time support.

**Architecture:** Three-layer build following Campos conventions. Core compute (`computeXGTimeline`) takes raw `Shot[]` and returns a pre-computed `XGTimelineModel` with step paths, area fills, markers, annotations, score strip segments, and axis guides. React renderer (`<XGTimeline>`) is a thin SVG translator consuming the model. Demo page in Astro uses real Opta fixture data.

**Tech Stack:** TypeScript, Vitest, React 19, SVG, Astro

**Spec:** `docs/specs/xgtimeline-spec.md`
**Demo data:** `apps/site/src/data/xgtimeline-demo.ts` (already created — hero, extra-time, one-team-dominant, sparse, empty fixtures)

---

## File Structure

### Core (`packages/core/`)

- **Create:** `src/xg-timeline.ts` — pure compute function, all types, all logic
- **Modify:** `src/index.ts` — add exports
- **Create:** `test/compute-xg-timeline.test.ts` — full test suite

### React (`packages/react/`)

- **Create:** `src/XGTimeline.tsx` — SVG renderer with crosshair interaction
- **Modify:** `src/index.ts` — add exports

### Demo (`apps/site/`)

- **Create:** `src/components/XGTimelinePreview.tsx` — Astro hydration wrapper
- **Create:** `src/pages/xgtimeline.astro` — demo page
- **Modify:** `src/components/Nav.astro` — add nav link

---

## Task 1: Core types and empty model

**Files:**

- Create: `packages/core/src/xg-timeline.ts`
- Create: `packages/core/test/compute-xg-timeline.test.ts`

This task defines all public types and the empty-state path. The model shape drives everything else.

- [ ] **Step 1: Write the test file with empty/edge-case tests**

```typescript
// packages/core/test/compute-xg-timeline.test.ts
import { describe, expect, it } from "vitest";
import { computeXGTimeline } from "../src/xg-timeline";
import type { Shot } from "@campos/schema";

function makeShot(
  overrides: Partial<Shot> & { teamId: string; minute: number; xg: number },
): Shot {
  return {
    kind: "shot",
    id: `test:${overrides.minute}-${overrides.teamId}`,
    matchId: "test-match",
    playerId: null,
    playerName: overrides.playerName ?? null,
    addedMinute: overrides.addedMinute ?? null,
    second: overrides.second ?? 0,
    period: overrides.period ?? 1,
    x: 85,
    y: 50,
    xgot: null,
    outcome: overrides.outcome ?? "off-target",
    bodyPart: overrides.bodyPart ?? "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: overrides.context ?? "regular-play",
    provider: "test",
    providerEventId: `ev-${overrides.minute}`,
    ...overrides,
  };
}

describe("computeXGTimeline", () => {
  describe("empty and edge states", () => {
    it("returns empty model for no shots", () => {
      const model = computeXGTimeline({
        shots: [],
        homeTeam: "Home",
        awayTeam: "Away",
      });
      expect(model.meta.empty).toBe(true);
      expect(model.emptyState).toEqual({ message: "No shot data" });
      expect(model.stepLines).toHaveLength(0);
      expect(model.markers).toHaveLength(0);
    });

    it("excludes shots without xg", () => {
      const model = computeXGTimeline({
        shots: [makeShot({ teamId: "home", minute: 10, xg: null as unknown as number })],
        homeTeam: "Home",
        awayTeam: "Away",
      });
      expect(model.meta.empty).toBe(true);
      expect(model.meta.warnings).toContainEqual(expect.stringContaining("excluded"));
    });

    it("renders valid chart with single shot", () => {
      const model = computeXGTimeline({
        shots: [makeShot({ teamId: "home", minute: 25, xg: 0.15 })],
        homeTeam: "Home",
        awayTeam: "Away",
      });
      expect(model.meta.empty).toBe(false);
      expect(model.stepLines).toHaveLength(2); // both teams get a line
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/core/test/compute-xg-timeline.test.ts`
Expected: FAIL — `computeXGTimeline` does not exist

- [ ] **Step 3: Create the core file with types and empty model**

```typescript
// packages/core/src/xg-timeline.ts
import type { Shot } from "@campos/schema";
import { createLinearScale, niceTicks } from "./scales/index.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type XGTimelineStepPoint = {
  /** Linear match minute (addedTime folded in) */
  matchMinute: number;
  /** Cumulative xG at this point */
  cumulativeXg: number;
};

export type XGTimelineStepLineModel = {
  team: "home" | "away";
  teamName: string;
  color: string;
  /** Ordered step points including (0,0) start and FT extension */
  points: XGTimelineStepPoint[];
  /** Pre-computed SVG step-after path (in plot-area local coords) */
  path: string;
  /** Final cumulative xG */
  totalXg: number;
};

export type XGTimelineAreaSegment = {
  /** SVG path for one contiguous fill region between the two lines */
  path: string;
  /** Fill color (leading team's color at low opacity) */
  color: string;
};

export type XGTimelineMarkerModel = {
  team: "home" | "away";
  matchMinute: number;
  cumulativeXg: number;
  xg: number;
  playerName: string;
  outcome: Shot["outcome"];
  bodyPart: Shot["bodyPart"];
  context: Shot["context"];
  /** Annotation tier: 1=goal (always), 2=high-xG miss (space permitting), 3=tooltip only */
  tier: 1 | 2 | 3;
  /** SVG x in plot-area coords */
  cx: number;
  /** SVG y in plot-area coords */
  cy: number;
  /** Marker radius */
  r: number;
  color: string;
};

export type XGTimelineAnnotationModel = {
  team: "home" | "away";
  matchMinute: number;
  text: string;
  /** SVG coordinates for the label anchor */
  x: number;
  y: number;
  color: string;
  /** Whether a leader line is needed from label to marker */
  leaderLine: { x1: number; y1: number; x2: number; y2: number } | null;
};

export type XGTimelineEndLabelModel = {
  team: "home" | "away";
  teamName: string;
  totalXg: string;
  x: number;
  y: number;
  color: string;
};

export type XGTimelineGuideModel = {
  matchMinute: number;
  label: string;
  x: number;
};

export type XGTimelineScoreStripSegment = {
  x1: number;
  x2: number;
  label: string;
  color: string;
};

export type XGTimelineBackgroundBand = {
  x1: number;
  x2: number;
  kind: "stoppage" | "extra-time";
};

export type XGTimelineAxisModel = {
  label: string;
  domain: [number, number];
  ticks: number[];
};

export type XGTimelineModel = {
  meta: {
    component: "XGTimeline";
    empty: boolean;
    totalShots: number;
    validShots: number;
    homeGoals: number;
    awayGoals: number;
    warnings: string[];
    accessibleLabel: string;
  };
  layout: {
    viewBox: { width: number; height: number };
    plotArea: { x: number; y: number; width: number; height: number };
  };
  axes: {
    x: XGTimelineAxisModel;
    y: XGTimelineAxisModel;
  };
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
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWBOX_W = 560;
const VIEWBOX_H = 320;
const MARGIN = { top: 20, right: 60, bottom: 40, left: 50 };

const PLOT_W = VIEWBOX_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

const DEFAULT_HOME_COLOR = "#c8102e"; // red
const DEFAULT_AWAY_COLOR = "#1d428a"; // navy blue

const TIER_2_XG_THRESHOLD = 0.3;
const GOAL_MARKER_R = 4;
const SHOT_MARKER_R = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fold addedMinute into a linear match minute for plotting. */
function linearMinute(shot: Shot): number {
  if (shot.addedMinute != null && shot.addedMinute > 0) {
    // Period end minute + added time
    const periodEnd = shot.period <= 2 ? shot.period * 45 : 90 + (shot.period - 2) * 15;
    return periodEnd + shot.addedMinute;
  }
  return shot.minute;
}

function isValidShot(shot: Shot): boolean {
  return (
    shot.xg != null &&
    Number.isFinite(shot.xg) &&
    shot.xg >= 0 &&
    typeof shot.teamId === "string" &&
    shot.teamId.length > 0 &&
    Number.isFinite(shot.minute)
  );
}

/** Determine match end minute from period data. */
function matchEndMinute(shots: readonly Shot[]): number {
  let maxPeriod = 2;
  let maxLinear = 90;
  for (const shot of shots) {
    if (shot.period > maxPeriod) maxPeriod = shot.period;
    const lm = linearMinute(shot);
    if (lm > maxLinear) maxLinear = lm;
  }
  // Regular time: at least 90. Extra time: at least 120.
  if (maxPeriod >= 3) return Math.max(120, maxLinear + 2);
  return Math.max(90, maxLinear + 2);
}

function stepAfterPath(
  points: XGTimelineStepPoint[],
  xScale: (v: number) => number,
  yScale: (v: number) => number,
): string {
  if (points.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const sx = xScale(p.matchMinute);
    const sy = yScale(p.cumulativeXg);
    if (i === 0) {
      parts.push(`M ${sx} ${sy}`);
    } else {
      // Step-after: horizontal first, then vertical
      parts.push(`H ${sx}`);
      parts.push(`V ${sy}`);
    }
  }
  return parts.join(" ");
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
    teamColors,
  } = input;

  const homeColor = teamColors?.[0] ?? DEFAULT_HOME_COLOR;
  const awayColor = teamColors?.[1] ?? DEFAULT_AWAY_COLOR;

  const warnings: string[] = [];

  // ---- validate shots -------------------------------------------------------
  const validShots = shots.filter(isValidShot);
  const excluded = shots.length - validShots.length;
  if (excluded > 0) {
    warnings.push(`${excluded} shot(s) excluded: missing xg, team, or minute`);
  }

  if (validShots.length === 0) {
    return emptyModel(shots.length, homeTeam, awayTeam);
  }

  // ---- identify teams -------------------------------------------------------
  // Home team = first teamId that appears; determine by counting or by position
  const teamIds = new Set(validShots.map((s) => s.teamId));
  const teamIdArr = [...teamIds];
  // Assign home/away: prefer the team with more shots as "home" if only 2 teams
  const homeTeamId = teamIdArr[0]!;
  const awayTeamId = teamIdArr[1] ?? "away-placeholder";

  // ---- sort shots by time ---------------------------------------------------
  const sorted = [...validShots].sort(
    (a, b) => a.period - b.period || a.minute - b.minute || a.second - b.second,
  );

  // ---- compute end minute ---------------------------------------------------
  const endMinute = matchEndMinute(sorted);
  const hasExtraTime = sorted.some((s) => s.period >= 3);

  // ---- build cumulative step data per team ----------------------------------
  const homeSteps: XGTimelineStepPoint[] = [{ matchMinute: 0, cumulativeXg: 0 }];
  const awaySteps: XGTimelineStepPoint[] = [{ matchMinute: 0, cumulativeXg: 0 }];
  let homeCum = 0;
  let awayCum = 0;
  let homeGoals = 0;
  let awayGoals = 0;

  for (const shot of sorted) {
    const lm = linearMinute(shot);
    const xg = shot.xg!;
    if (shot.teamId === homeTeamId) {
      homeCum += xg;
      homeSteps.push({ matchMinute: lm, cumulativeXg: homeCum });
      if (shot.outcome === "goal") homeGoals++;
    } else {
      awayCum += xg;
      awaySteps.push({ matchMinute: lm, cumulativeXg: awayCum });
      if (shot.outcome === "goal") awayGoals++;
    }
  }

  // Extend lines to match end
  homeSteps.push({ matchMinute: endMinute, cumulativeXg: homeCum });
  awaySteps.push({ matchMinute: endMinute, cumulativeXg: awayCum });

  // ---- compute axes ---------------------------------------------------------
  const maxXg = Math.max(homeCum, awayCum, 0.5);
  const yNice = niceTicks(0, maxXg, 5);
  // Force y-domain to start at 0
  yNice.domain[0] = 0;

  const xDomain: [number, number] = [0, endMinute];
  const xTicks: number[] = [];
  for (let m = 0; m <= endMinute; m += 15) {
    xTicks.push(m);
  }
  // Ensure end minute tick
  if (xTicks[xTicks.length - 1] !== endMinute && endMinute > 90) {
    // Don't add FT as a tick; the guide handles it
  }

  // ---- compute scales -------------------------------------------------------
  const xScale = createLinearScale(xDomain, [0, PLOT_W]);
  const yScale = createLinearScale(yNice.domain, [PLOT_H, 0]); // SVG y is inverted

  // ---- build step line models -----------------------------------------------
  const homePath = stepAfterPath(homeSteps, xScale, yScale);
  const awayPath = stepAfterPath(awaySteps, xScale, yScale);

  const stepLines: XGTimelineStepLineModel[] = [
    {
      team: "home",
      teamName: homeTeam,
      color: homeColor,
      points: homeSteps,
      path: homePath,
      totalXg: Number(homeCum.toFixed(2)),
    },
    {
      team: "away",
      teamName: awayTeam,
      color: awayColor,
      points: awaySteps,
      path: awayPath,
      totalXg: Number(awayCum.toFixed(2)),
    },
  ];

  // ---- build area fill segments ---------------------------------------------
  const areaSegments: XGTimelineAreaSegment[] = [];
  if (showAreaFill && layout === "ascending") {
    // Build area fill between the two step lines
    // Merge both teams' step points into a unified timeline
    const allMinutes = new Set<number>();
    for (const p of homeSteps) allMinutes.add(p.matchMinute);
    for (const p of awaySteps) allMinutes.add(p.matchMinute);
    const sortedMinutes = [...allMinutes].sort((a, b) => a - b);

    // Get cumulative xG at any minute for each team (step-after lookup)
    function xgAt(steps: XGTimelineStepPoint[], minute: number): number {
      let val = 0;
      for (const p of steps) {
        if (p.matchMinute > minute) break;
        val = p.cumulativeXg;
      }
      return val;
    }

    // Build a single filled polygon between the two lines
    // Top edge: follow the leading team; bottom edge: follow the trailing team
    // For simplicity, build one path that traces home forward then away backward
    if (sortedMinutes.length >= 2) {
      const topPoints: string[] = [];
      const bottomPoints: string[] = [];

      for (const m of sortedMinutes) {
        const hXg = xgAt(homeSteps, m);
        const aXg = xgAt(awaySteps, m);
        const sx = xScale(m);
        // For step-after, we need horizontal segments
        topPoints.push(`${sx},${yScale(Math.max(hXg, aXg))}`);
        bottomPoints.push(`${sx},${yScale(Math.min(hXg, aXg))}`);
      }

      // We need proper step-after for the area fill too
      // Build the step-after area as a series of rectangles between consecutive time points
      for (let i = 0; i < sortedMinutes.length - 1; i++) {
        const m1 = sortedMinutes[i]!;
        const m2 = sortedMinutes[i + 1]!;
        const hXg = xgAt(homeSteps, m1);
        const aXg = xgAt(awaySteps, m1);

        if (Math.abs(hXg - aXg) < 0.001) continue; // teams tied, skip

        const x1 = MARGIN.left + xScale(m1);
        const x2 = MARGIN.left + xScale(m2);
        const yTop = MARGIN.top + yScale(Math.max(hXg, aXg));
        const yBot = MARGIN.top + yScale(Math.min(hXg, aXg));

        const leaderColor = hXg > aXg ? homeColor : awayColor;
        areaSegments.push({
          path: `M ${x1} ${yTop} H ${x2} V ${yBot} H ${x1} Z`,
          color: leaderColor,
        });
      }
    }
  }

  if (showAreaFill && layout === "mirrored") {
    // Mirrored: fill from zero to each team's line
    // Home fills upward, away fills downward from zero
    // Each team gets its own fill
    const zeroY = MARGIN.top + yScale(0);

    for (const steps of [homeSteps, awaySteps]) {
      const isHome = steps === homeSteps;
      const color = isHome ? homeColor : awayColor;
      const pathParts: string[] = [];

      // Trace step-after path forward
      for (let i = 0; i < steps.length; i++) {
        const p = steps[i]!;
        const sx = MARGIN.left + xScale(p.matchMinute);
        const sy = MARGIN.top + yScale(p.cumulativeXg);
        if (i === 0) {
          pathParts.push(`M ${sx} ${zeroY}`);
          pathParts.push(`V ${sy}`);
        } else {
          pathParts.push(`H ${sx}`);
          pathParts.push(`V ${sy}`);
        }
      }
      // Close back along zero line
      const lastX = MARGIN.left + xScale(steps[steps.length - 1]!.matchMinute);
      pathParts.push(`V ${zeroY}`);
      pathParts.push(`H ${MARGIN.left + xScale(0)}`);
      pathParts.push("Z");

      if (steps.some((p) => p.cumulativeXg > 0)) {
        areaSegments.push({ path: pathParts.join(" "), color });
      }
    }
  }

  // ---- build markers --------------------------------------------------------
  const markers: XGTimelineMarkerModel[] = [];
  const shotsByWindow = new Map<number, number>(); // 15-min window → annotation count

  for (const shot of sorted) {
    const lm = linearMinute(shot);
    const isHome = shot.teamId === homeTeamId;
    const color = isHome ? homeColor : awayColor;
    const cumXg = isHome ? xgAt(homeSteps, lm) : xgAt(awaySteps, lm);

    // Determine tier
    let tier: 1 | 2 | 3;
    if (shot.outcome === "goal") {
      tier = 1;
    } else if ((shot.xg ?? 0) >= TIER_2_XG_THRESHOLD) {
      tier = 2;
    } else {
      tier = 3;
    }

    // Check 15-min window density for tier 2
    if (tier === 2) {
      const window = Math.floor(lm / 15);
      const count = shotsByWindow.get(window) ?? 0;
      if (count >= 3) tier = 3; // demote to tooltip-only
    }

    if (tier <= 2) {
      const window = Math.floor(lm / 15);
      shotsByWindow.set(window, (shotsByWindow.get(window) ?? 0) + 1);
    }

    const showDot = tier === 1 || (tier <= 3 && showShotDots) || tier === 2;

    if (showDot) {
      markers.push({
        team: isHome ? "home" : "away",
        matchMinute: lm,
        cumulativeXg: cumXg,
        xg: shot.xg!,
        playerName: shot.playerName ?? "Unknown player",
        outcome: shot.outcome,
        bodyPart: shot.bodyPart,
        context: shot.context,
        tier,
        cx: MARGIN.left + xScale(lm),
        cy: MARGIN.top + yScale(cumXg),
        r: tier === 1 ? GOAL_MARKER_R : SHOT_MARKER_R,
        color,
      });
    }
  }

  // Helper needed inside marker loop — extract to top-level function scope
  function xgAt(steps: XGTimelineStepPoint[], minute: number): number {
    let val = 0;
    for (const p of steps) {
      if (p.matchMinute > minute) break;
      val = p.cumulativeXg;
    }
    return val;
  }

  // ---- build annotations (tier 1 and 2 labels) -----------------------------
  const annotations: XGTimelineAnnotationModel[] = [];
  for (const marker of markers) {
    if (marker.tier > 2) continue;
    const labelText =
      marker.tier === 1
        ? `${marker.playerName} ${marker.xg.toFixed(2)} xG`
        : (marker.playerName.split(" ").pop() ?? marker.playerName);

    const labelY = marker.cy - (marker.r + 8);
    annotations.push({
      team: marker.team,
      matchMinute: marker.matchMinute,
      text: labelText,
      x: marker.cx,
      y: labelY,
      color: marker.color,
      leaderLine: null,
    });
  }

  // ---- build end labels -----------------------------------------------------
  const homeEndY = MARGIN.top + yScale(homeCum);
  const awayEndY = MARGIN.top + yScale(awayCum);
  const endX = MARGIN.left + PLOT_W + 6;

  // Avoid overlap: minimum 12px gap
  let adjHomeY = homeEndY;
  let adjAwayY = awayEndY;
  if (Math.abs(adjHomeY - adjAwayY) < 12) {
    const mid = (adjHomeY + adjAwayY) / 2;
    adjHomeY = mid - 7;
    adjAwayY = mid + 7;
  }

  const endLabels: XGTimelineEndLabelModel[] = [
    {
      team: "home",
      teamName: homeTeam,
      totalXg: homeCum.toFixed(2),
      x: endX,
      y: adjHomeY,
      color: homeColor,
    },
    {
      team: "away",
      teamName: awayTeam,
      totalXg: awayCum.toFixed(2),
      x: endX,
      y: adjAwayY,
      color: awayColor,
    },
  ];

  // ---- build time guides (HT, FT, ET) --------------------------------------
  const guides: XGTimelineGuideModel[] = [
    { matchMinute: 45, label: "HT", x: MARGIN.left + xScale(45) },
    { matchMinute: 90, label: "FT", x: MARGIN.left + xScale(90) },
  ];
  if (hasExtraTime) {
    guides.push(
      { matchMinute: 105, label: "ET HT", x: MARGIN.left + xScale(105) },
      { matchMinute: 120, label: "ET FT", x: MARGIN.left + xScale(120) },
    );
  }

  // ---- build score strip segments -------------------------------------------
  const scoreStrip: XGTimelineScoreStripSegment[] = [];
  if (showScoreStrip) {
    const goalEvents = sorted
      .filter((s) => s.outcome === "goal")
      .map((s) => ({
        minute: linearMinute(s),
        isHome: s.teamId === homeTeamId,
      }));

    let hScore = 0;
    let aScore = 0;
    let prevMinute = 0;
    const neutralColor = "#999";

    for (const goal of goalEvents) {
      scoreStrip.push({
        x1: MARGIN.left + xScale(prevMinute),
        x2: MARGIN.left + xScale(goal.minute),
        label: `${hScore}-${aScore}`,
        color: hScore > aScore ? homeColor : aScore > hScore ? awayColor : neutralColor,
      });
      if (goal.isHome) hScore++;
      else aScore++;
      prevMinute = goal.minute;
    }
    // Final segment
    scoreStrip.push({
      x1: MARGIN.left + xScale(prevMinute),
      x2: MARGIN.left + xScale(endMinute),
      label: `${hScore}-${aScore}`,
      color: hScore > aScore ? homeColor : aScore > hScore ? awayColor : neutralColor,
    });
  }

  // ---- build background bands -----------------------------------------------
  const backgroundBands: XGTimelineBackgroundBand[] = [];
  // First-half stoppage: find max added time in period 1
  const p1Stoppage = sorted
    .filter((s) => s.period === 1 && s.addedMinute != null && s.addedMinute > 0)
    .reduce((max, s) => Math.max(max, linearMinute(s)), 0);
  if (p1Stoppage > 45) {
    backgroundBands.push({
      x1: MARGIN.left + xScale(45),
      x2: MARGIN.left + xScale(p1Stoppage + 1),
      kind: "stoppage",
    });
  }

  // Second-half stoppage
  const p2Stoppage = sorted
    .filter((s) => s.period === 2 && s.addedMinute != null && s.addedMinute > 0)
    .reduce((max, s) => Math.max(max, linearMinute(s)), 0);
  if (p2Stoppage > 90) {
    backgroundBands.push({
      x1: MARGIN.left + xScale(90),
      x2: MARGIN.left + xScale(p2Stoppage + 1),
      kind: "stoppage",
    });
  }

  // Extra-time background shade
  if (hasExtraTime) {
    backgroundBands.push({
      x1: MARGIN.left + xScale(90),
      x2: MARGIN.left + xScale(endMinute),
      kind: "extra-time",
    });
  }

  // ---- accessible label -----------------------------------------------------
  const accessibleLabel = `xG Timeline: ${homeTeam} ${homeGoals} (${homeCum.toFixed(2)} xG) vs ${awayTeam} ${awayGoals} (${awayCum.toFixed(2)} xG)`;

  return {
    meta: {
      component: "XGTimeline",
      empty: false,
      totalShots: shots.length,
      validShots: validShots.length,
      homeGoals,
      awayGoals,
      warnings,
      accessibleLabel,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea: { x: MARGIN.left, y: MARGIN.top, width: PLOT_W, height: PLOT_H },
    },
    axes: {
      x: { label: "Minute", domain: xDomain, ticks: xTicks },
      y: { label: "Expected Goals", domain: yNice.domain, ticks: yNice.ticks },
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
// Empty model
// ---------------------------------------------------------------------------

function emptyModel(
  totalShots: number,
  homeTeam: string,
  awayTeam: string,
): XGTimelineModel {
  return {
    meta: {
      component: "XGTimeline",
      empty: true,
      totalShots,
      validShots: 0,
      homeGoals: 0,
      awayGoals: 0,
      warnings:
        totalShots > 0
          ? [`${totalShots} shot(s) excluded: missing xg, team, or minute`]
          : [],
      accessibleLabel: `xG Timeline: ${homeTeam} vs ${awayTeam} — no shot data`,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea: { x: MARGIN.left, y: MARGIN.top, width: PLOT_W, height: PLOT_H },
    },
    axes: {
      x: { label: "Minute", domain: [0, 90], ticks: [] },
      y: { label: "Expected Goals", domain: [0, 1], ticks: [] },
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
```

**Note:** There is a duplicate `xgAt` function — the one inside the computation function body is hoisted and used for both marker computation and area fill. The implementer should refactor to keep only one copy at the top of `computeXGTimeline`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/core/test/compute-xg-timeline.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Add core exports**

Add to `packages/core/src/index.ts`:

```typescript
export { computeXGTimeline } from "./xg-timeline.js";
export type {
  ComputeXGTimelineInput,
  XGTimelineAnnotationModel,
  XGTimelineAreaSegment,
  XGTimelineAxisModel,
  XGTimelineBackgroundBand,
  XGTimelineEndLabelModel,
  XGTimelineGuideModel,
  XGTimelineMarkerModel,
  XGTimelineModel,
  XGTimelineScoreStripSegment,
  XGTimelineStepLineModel,
  XGTimelineStepPoint,
} from "./xg-timeline.js";
```

- [ ] **Step 6: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```
feat(core): add computeXGTimeline with types, step-after, area fill, markers, annotations
```

---

## Task 2: Core tests — step-after, stoppage time, extra time, annotations

**Files:**

- Modify: `packages/core/test/compute-xg-timeline.test.ts`

Add comprehensive tests for the core computation. These drive correctness.

- [ ] **Step 1: Add step-after and cumulative xG tests**

Append to the test file:

```typescript
describe("step-after construction", () => {
  const shots = [
    makeShot({ teamId: "home", minute: 10, xg: 0.15, period: 1 }),
    makeShot({
      teamId: "away",
      minute: 20,
      xg: 0.3,
      period: 1,
      outcome: "goal",
      playerName: "Player A",
    }),
    makeShot({
      teamId: "home",
      minute: 35,
      xg: 0.5,
      period: 1,
      outcome: "goal",
      playerName: "Player B",
    }),
    makeShot({ teamId: "away", minute: 60, xg: 0.1, period: 2 }),
    makeShot({ teamId: "home", minute: 75, xg: 0.2, period: 2 }),
  ];

  it("produces two step lines starting at (0, 0)", () => {
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.stepLines).toHaveLength(2);
    expect(model.stepLines[0]!.points[0]).toEqual({ matchMinute: 0, cumulativeXg: 0 });
    expect(model.stepLines[1]!.points[0]).toEqual({ matchMinute: 0, cumulativeXg: 0 });
  });

  it("accumulates xG cumulatively per team", () => {
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const homeLine = model.stepLines[0]!;
    // Points: (0,0), (10, 0.15), (35, 0.65), (75, 0.85), (endMinute, 0.85)
    expect(homeLine.totalXg).toBeCloseTo(0.85, 2);

    const awayLine = model.stepLines[1]!;
    // Points: (0,0), (20, 0.30), (60, 0.40), (endMinute, 0.40)
    expect(awayLine.totalXg).toBeCloseTo(0.4, 2);
  });

  it("extends lines to match end minute", () => {
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const homeLast = model.stepLines[0]!.points.at(-1)!;
    const awayLast = model.stepLines[1]!.points.at(-1)!;
    expect(homeLast.matchMinute).toBeGreaterThanOrEqual(90);
    expect(awayLast.matchMinute).toBeGreaterThanOrEqual(90);
    // Last point has same cumXg as the previous real shot
    expect(homeLast.cumulativeXg).toBeCloseTo(0.85, 2);
  });

  it("step paths start with M and contain H/V segments", () => {
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.stepLines[0]!.path).toMatch(/^M /);
    expect(model.stepLines[0]!.path).toContain("H ");
    expect(model.stepLines[0]!.path).toContain("V ");
  });

  it("counts goals correctly", () => {
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.meta.homeGoals).toBe(1);
    expect(model.meta.awayGoals).toBe(1);
  });
});
```

- [ ] **Step 2: Add stoppage-time and extra-time tests**

```typescript
describe("stoppage time", () => {
  it("folds addedMinute into linear time", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 45, addedMinute: 2, xg: 0.1, period: 1 }),
      makeShot({ teamId: "home", minute: 90, addedMinute: 3, xg: 0.2, period: 2 }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const points = model.stepLines[0]!.points;
    // (0,0), (47, 0.10), (93, 0.30), (endMinute, 0.30)
    expect(points[1]!.matchMinute).toBe(47); // 45 + 2
    expect(points[2]!.matchMinute).toBe(93); // 90 + 3
  });

  it("creates stoppage background bands", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 45, addedMinute: 3, xg: 0.1, period: 1 }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.backgroundBands.some((b) => b.kind === "stoppage")).toBe(true);
  });
});

describe("extra time", () => {
  it("extends axis to 120+ for period 3/4 shots", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 30, xg: 0.2, period: 1 }),
      makeShot({ teamId: "away", minute: 105, xg: 0.3, period: 3 }),
      makeShot({ teamId: "home", minute: 115, xg: 0.4, period: 4 }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.axes.x.domain[1]).toBeGreaterThanOrEqual(120);
  });

  it("adds ET HT and ET FT guides", () => {
    const shots = [makeShot({ teamId: "home", minute: 100, xg: 0.2, period: 3 })];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const labels = model.guides.map((g) => g.label);
    expect(labels).toContain("ET HT");
    expect(labels).toContain("ET FT");
  });

  it("creates extra-time background band", () => {
    const shots = [makeShot({ teamId: "home", minute: 100, xg: 0.2, period: 3 })];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.backgroundBands.some((b) => b.kind === "extra-time")).toBe(true);
  });
});
```

- [ ] **Step 3: Add annotation tier and end label tests**

```typescript
describe("annotation tiers", () => {
  it("assigns tier 1 to goals", () => {
    const shots = [
      makeShot({
        teamId: "home",
        minute: 30,
        xg: 0.1,
        outcome: "goal",
        playerName: "Scorer",
      }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const goalMarker = model.markers.find((m) => m.outcome === "goal");
    expect(goalMarker?.tier).toBe(1);
  });

  it("assigns tier 2 to high-xG non-goals", () => {
    const shots = [
      makeShot({
        teamId: "home",
        minute: 30,
        xg: 0.35,
        outcome: "saved",
        playerName: "Shooter",
      }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const marker = model.markers.find((m) => m.outcome === "saved");
    expect(marker?.tier).toBe(2);
  });

  it("assigns tier 3 to low-xG non-goals", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 30, xg: 0.05, outcome: "off-target" }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const marker = model.markers.find((m) => m.outcome === "off-target");
    expect(marker?.tier).toBe(3);
  });

  it("creates annotations only for tier 1 and 2", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 10, xg: 0.05, outcome: "off-target" }),
      makeShot({
        teamId: "home",
        minute: 30,
        xg: 0.35,
        outcome: "saved",
        playerName: "Big Miss",
      }),
      makeShot({
        teamId: "home",
        minute: 60,
        xg: 0.2,
        outcome: "goal",
        playerName: "Scorer",
      }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.annotations).toHaveLength(2); // goal + big miss
    expect(model.annotations.some((a) => a.text.includes("Scorer"))).toBe(true);
    expect(model.annotations.some((a) => a.text.includes("Miss"))).toBe(true);
  });
});

describe("end labels", () => {
  it("produces two end labels with total xG", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 30, xg: 0.5 }),
      makeShot({ teamId: "away", minute: 60, xg: 0.25 }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.endLabels).toHaveLength(2);
    expect(model.endLabels[0]!.totalXg).toBe("0.50");
    expect(model.endLabels[1]!.totalXg).toBe("0.25");
  });

  it("separates overlapping end labels", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 30, xg: 0.5 }),
      makeShot({ teamId: "away", minute: 60, xg: 0.5 }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    const [label1, label2] = model.endLabels;
    expect(Math.abs(label1!.y - label2!.y)).toBeGreaterThanOrEqual(12);
  });
});
```

- [ ] **Step 4: Add score strip and one-team fallback tests**

```typescript
describe("score strip", () => {
  it("is empty when showScoreStrip is false", () => {
    const shots = [makeShot({ teamId: "home", minute: 30, xg: 0.5, outcome: "goal" })];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.scoreStrip).toHaveLength(0);
  });

  it("segments at each goal when enabled", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 20, xg: 0.4, outcome: "goal" }),
      makeShot({ teamId: "away", minute: 50, xg: 0.3, outcome: "goal" }),
    ];
    const model = computeXGTimeline({
      shots,
      homeTeam: "Home",
      awayTeam: "Away",
      showScoreStrip: true,
    });
    // Segments: 0-0 (0→20), 1-0 (20→50), 1-1 (50→end)
    expect(model.scoreStrip).toHaveLength(3);
    expect(model.scoreStrip[0]!.label).toBe("0-0");
    expect(model.scoreStrip[1]!.label).toBe("1-0");
    expect(model.scoreStrip[2]!.label).toBe("1-1");
  });
});

describe("one-team fallback", () => {
  it("renders two lines even when only one team has shots", () => {
    const shots = [
      makeShot({ teamId: "home", minute: 30, xg: 0.5 }),
      makeShot({ teamId: "home", minute: 60, xg: 0.3, outcome: "goal" }),
    ];
    const model = computeXGTimeline({ shots, homeTeam: "Home", awayTeam: "Away" });
    expect(model.stepLines).toHaveLength(2);
    // Away line should be flat at 0
    expect(model.stepLines[1]!.totalXg).toBe(0);
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `pnpm exec vitest run packages/core/test/compute-xg-timeline.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```
test(core): add comprehensive xG timeline core tests
```

---

## Task 3: React renderer

**Files:**

- Create: `packages/react/src/XGTimeline.tsx`
- Modify: `packages/react/src/index.ts`

Build the SVG renderer following the ScatterPlot pattern.

- [ ] **Step 1: Create the React component**

Create `packages/react/src/XGTimeline.tsx`. The component should:

- Call `computeXGTimeline` in a `useMemo`
- Render SVG with background bands, grid, axes, step lines, area fill, markers, annotations, end labels, guides, score strip
- Track mouse position for crosshair using `useState` and `onMouseMove`/`onMouseLeave`
- Show tooltip on marker hover
- Use `useTheme()` for colors
- Follow the same `<section>` → `<div>` → `<svg>` → tooltip overlay → legend pattern as RadarChart/ScatterPlot

Key rendering layers (in SVG paint order):

1. Plot area background rect
2. Background bands (stoppage time, extra time shading)
3. Grid lines (y-axis horizontal at each tick)
4. Area fill segments (low opacity)
5. Step lines (main visual — 2-3px stroke)
6. Time guide lines (HT, FT dashed verticals)
7. Shot markers (circles)
8. Goal annotations (text + optional leader lines)
9. Axes (x-axis with ticks, y-axis with ticks)
10. End labels (right of plot area)
11. Score strip (above plot area, when enabled)
12. Crosshair overlay (vertical line + cumulative labels, follows mouse)

The crosshair needs `onMouseMove` on the SVG or a transparent rect over the plot area. Convert mouse X to match minute via inverse scale, then look up cumulative xG for each team at that minute.

- [ ] **Step 2: Add React exports**

Add to `packages/react/src/index.ts`:

```typescript
export { XGTimeline } from "./XGTimeline.js";
export type { XGTimelineProps } from "./XGTimeline.js";
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```
feat(react): add XGTimeline renderer with step lines, area fill, crosshair, annotations
```

---

## Task 4: Demo page

**Files:**

- Create: `apps/site/src/components/XGTimelinePreview.tsx`
- Create: `apps/site/src/pages/xgtimeline.astro`
- Modify: `apps/site/src/components/Nav.astro`

- [ ] **Step 1: Create the preview wrapper**

`apps/site/src/components/XGTimelinePreview.tsx` — thin wrapper that imports `XGTimeline` from `@campos/react` and accepts a `variant` prop to select between hero, empty, sparse, one-team, extra-time, mirrored, score-strip, area-fill-off, etc.

- [ ] **Step 2: Create the Astro page**

`apps/site/src/pages/xgtimeline.astro` following the `ComponentPage` + `DemoCard` pattern from `demo-page-standard.md`:

- Hero: hero fixture, ascending, default props
- States grid demos: empty, sparse, mirrored, one-team-dominant, extra-time, area-fill off, score-strip on, crosshair

- [ ] **Step 3: Add nav link**

In `apps/site/src/components/Nav.astro`, add `{ label: "XGTimeline", href: "/xgtimeline" }` to the `chartLinks` array.

- [ ] **Step 4: Build and verify**

Run: `pnpm --filter @campos/site build`
Expected: PASS — no build errors

- [ ] **Step 5: Commit**

```
feat(site): add XGTimeline demo page with all fixture variants
```

---

## Task 5: Final checks

- [ ] **Step 1: Run all quality checks**

Run: `pnpm check`
Expected: PASS (lint, format, typecheck, test)

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Update status matrix**

In `docs/status/matrix.md`, update the XGTimeline row to reflect implementation progress.

- [ ] **Step 4: Final commit**

```
docs: update status matrix for XGTimeline implementation
```

Plan complete and saved to `docs/archived/superpowers/plans/2026-04-09-xgtimeline.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
