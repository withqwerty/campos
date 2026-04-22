import type { PassEvent } from "@withqwerty/campos-schema";

import type { HeaderStatsItem } from "./shot-map.js";
import { clamp, formatMinute } from "./math.js";

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

const COMPLETION_COLORS: Record<string, string> = {
  complete: "#7ce2a1",
  incomplete: "#f27068",
  offside: "#f2a93b",
  out: "#8792a8",
  unknown: "#b8c0cc",
};

const PASS_TYPE_LABELS: Record<string, string> = {
  ground: "Ground",
  low: "Low",
  high: "High",
  "through-ball": "Through ball",
  cross: "Cross",
  corner: "Corner",
  "free-kick": "Free kick",
  "goal-kick": "Goal kick",
  "throw-in": "Throw-in",
  "kick-off": "Kick-off",
  other: "Other",
};

const COMPLETION_LABELS: Record<string, string> = {
  complete: "Complete",
  incomplete: "Incomplete",
  offside: "Offside",
  out: "Out",
  unknown: "Unknown",
};

const COMPLETION_ORDER = ["complete", "incomplete", "offside", "out", "unknown"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PassMapTooltipModel = {
  rows: Array<{
    key:
      | "playerName"
      | "recipient"
      | "minute"
      | "passResult"
      | "passType"
      | "length"
      | "isAssist";
    label: string;
    value: string;
  }>;
};

export type PassMapMarkerModel = {
  passId: string;
  x: number;
  y: number;
  endX: number;
  endY: number;
  isDot: boolean;
  color: string;
  tooltip: PassMapTooltipModel;
};

export type PassMapLegendItem = {
  key: string;
  label: string;
  color: string;
};

export type PassMapLegendModel = {
  title: string;
  items: PassMapLegendItem[];
};

export type PassMapLayoutModel = {
  order: Array<"headerStats" | "plot" | "legend">;
  aspectRatio: string;
  minPlotHeightRatio: number;
};

export type PassMapModel = {
  meta: {
    component: "PassMap";
    empty: boolean;
    accessibleLabel: string;
    colorBy: "completion" | "passType";
    crop: "full" | "half";
    attackingDirection: "up" | "down" | "left" | "right";
  };
  layout: PassMapLayoutModel;
  headerStats: {
    items: HeaderStatsItem[];
  } | null;
  legend: PassMapLegendModel | null;
  plot: {
    pitch: {
      crop: "full" | "half";
      attackingDirection: "up" | "down" | "left" | "right";
    };
    markers: PassMapMarkerModel[];
  };
  emptyState: {
    message: string;
  } | null;
};

export type ComputePassMapInput = {
  passes: readonly PassEvent[];
  crop?: "full" | "half";
  attackingDirection?: "up" | "down" | "left" | "right";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aspectRatioFor(
  crop: "full" | "half",
  direction: "up" | "down" | "left" | "right",
): string {
  const isVertical = direction === "up" || direction === "down";
  if (crop === "half") return isVertical ? "4:5" : "5:4";
  return isVertical ? "2:3" : "3:2";
}

function formatPassResult(result: PassEvent["passResult"]): string {
  switch (result) {
    case "complete":
      return "Complete";
    case "incomplete":
      return "Incomplete";
    case "offside":
      return "Offside";
    case "out":
      return "Out";
    default:
      return "Unknown";
  }
}

function formatPassType(passType: PassEvent["passType"]): string | null {
  if (passType == null) {
    return null;
  }
  return PASS_TYPE_LABELS[passType] ?? null;
}

const FALLBACK_LINE_COLOR = "#b8c0cc";

function colorForCompletion(passResult: PassEvent["passResult"]): string {
  if (passResult == null) {
    return FALLBACK_LINE_COLOR;
  }
  return COMPLETION_COLORS[passResult] ?? FALLBACK_LINE_COLOR;
}

function hasEndCoordinates(
  pass: PassEvent,
): pass is PassEvent & { endX: number; endY: number } {
  return Number.isFinite(pass.endX) && Number.isFinite(pass.endY);
}

function buildTooltipRows(pass: PassEvent): PassMapTooltipModel {
  const rows: PassMapTooltipModel["rows"] = [
    {
      key: "playerName",
      label: "Player",
      value: pass.playerName ?? "Unknown player",
    },
    {
      key: "minute",
      label: "Minute",
      value: formatMinute(pass.minute),
    },
  ];

  if (pass.passResult != null) {
    rows.push({
      key: "passResult",
      label: "Result",
      value: formatPassResult(pass.passResult),
    });
  }

  const passTypeLabel = formatPassType(pass.passType);
  if (passTypeLabel) {
    rows.push({
      key: "passType",
      label: "Type",
      value: passTypeLabel,
    });
  }

  if (pass.recipient) {
    rows.push({
      key: "recipient",
      label: "Recipient",
      value: pass.recipient,
    });
  }

  if (pass.length != null) {
    rows.push({
      key: "length",
      label: "Length",
      value: pass.length.toFixed(1),
    });
  }

  if (pass.isAssist) {
    rows.push({
      key: "isAssist",
      label: "Assist",
      value: "Yes",
    });
  }

  return { rows };
}

// ---------------------------------------------------------------------------
// Main compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for the Campos PassMap.
 */
export function computePassMap(input: ComputePassMapInput): PassMapModel {
  const colorBy = "completion";
  const crop = input.crop ?? "full";
  const attackingDirection = input.attackingDirection ?? "up";

  // Filter passes with valid start coordinates
  const plottable = input.passes.filter(
    (pass): pass is PassEvent & { x: number; y: number } =>
      Number.isFinite(pass.x) && Number.isFinite(pass.y),
  );

  // For half crop, only include passes whose destination is in the attacking half (endX >= 50)
  // or whose origin is in the attacking half (for dots without endX)
  const cropped =
    crop === "half"
      ? plottable.filter((pass) => {
          if (hasEndCoordinates(pass)) {
            return pass.endX >= 50;
          }
          return pass.x >= 50;
        })
      : plottable;

  // Compute header stats
  const passesWithResult = cropped.filter(
    (pass) => pass.passResult != null && hasEndCoordinates(pass),
  );
  const completeCount = passesWithResult.filter(
    (pass) => pass.passResult === "complete",
  ).length;
  const completionRate =
    passesWithResult.length > 0
      ? Math.round((completeCount / passesWithResult.length) * 100)
      : null;

  if (cropped.length === 0) {
    return {
      meta: {
        component: "PassMap",
        empty: true,
        accessibleLabel: "Pass map: 0 passes",
        colorBy,
        crop,
        attackingDirection,
      },
      layout: {
        order: ["headerStats", "plot", "legend"],
        aspectRatio: aspectRatioFor(crop, attackingDirection),
        minPlotHeightRatio: 0.6,
      },
      headerStats: {
        items: [
          { label: "Passes", value: "0" },
          { label: "Completion", value: "—" },
        ],
      },
      legend: null,
      plot: {
        pitch: { crop, attackingDirection },
        markers: [],
      },
      emptyState: {
        message: "No pass data",
      },
    };
  }

  // Build markers
  const markers: PassMapMarkerModel[] = cropped.map((pass) => {
    const isDot = !hasEndCoordinates(pass);
    const x = clamp(pass.x, 0, 100);
    const y = clamp(pass.y, 0, 100);
    const endX = isDot ? x : clamp(pass.endX, 0, 100);
    const endY = isDot ? y : clamp(pass.endY, 0, 100);

    const color = colorForCompletion(pass.passResult);

    return {
      passId: pass.id,
      x,
      y,
      endX,
      endY,
      isDot,
      color,
      tooltip: buildTooltipRows(pass),
    };
  });

  // Build legend from observed values
  let legend: PassMapLegendModel | null = null;
  const observedResultSet = new Set(
    cropped.map((pass) => (pass.passResult != null ? pass.passResult : "unknown")),
  );
  const observedResults = COMPLETION_ORDER.filter((key) => observedResultSet.has(key));
  if (observedResults.length > 1) {
    legend = {
      title: "Result",
      items: observedResults.map((key) => ({
        key,
        label: COMPLETION_LABELS[key] ?? key,
        color: COMPLETION_COLORS[key] ?? FALLBACK_LINE_COLOR,
      })),
    };
  }

  // If all passResults are null, hide the legend in completion mode
  const allResultsNull = cropped.every((pass) => pass.passResult == null);
  if (allResultsNull) {
    legend = null;
  }

  // Header stats
  const headerItems: HeaderStatsItem[] = [
    { label: "Passes", value: String(cropped.length) },
  ];
  if (completionRate != null) {
    headerItems.push({ label: "Completion", value: `${completionRate}%` });
  } else {
    headerItems.push({ label: "Completion", value: "—" });
  }

  return {
    meta: {
      component: "PassMap",
      empty: false,
      accessibleLabel: `Pass map: ${cropped.length} passes${completionRate != null ? `, ${completionRate}% completion` : ""}`,
      colorBy,
      crop,
      attackingDirection,
    },
    layout: {
      order: ["headerStats", "plot", "legend"],
      aspectRatio: aspectRatioFor(crop, attackingDirection),
      minPlotHeightRatio: 0.6,
    },
    headerStats: {
      items: headerItems,
    },
    legend,
    plot: {
      pitch: { crop, attackingDirection },
      markers,
    },
    emptyState: null,
  };
}
