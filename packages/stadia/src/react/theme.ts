export type PitchColors = {
  fill?: string;
  lines?: string;
  markings?: string;
};

export type GoalColors = {
  frame?: string;
  net?: string;
  ground?: string;
  background?: string;
  /**
   * Fill for the floor plane inside the goal mouth (the trapezoid between
   * the front ground line and the recessed back-ground line). When unset,
   * the background shows through. Ignored when `netShape="flat"`.
   */
  floor?: string;
};

export type Theme = "primary" | "secondary";

// Primary: classic green pitch with white lines
const PRIMARY_PITCH: Required<PitchColors> = {
  fill: "#2d8a4e",
  lines: "#ffffffcc",
  markings: "#ffffff55",
};

// Secondary: dark slate pitch with bright lines
const SECONDARY_PITCH: Required<PitchColors> = {
  fill: "#1e293b",
  lines: "#f8fafc",
  markings: "#f8fafc44",
};

const PRIMARY_GOAL: Required<GoalColors> = {
  frame: "#8f8f93",
  net: "#c7ccd4",
  ground: "#9aa0a6",
  background: "transparent",
  floor: "transparent",
};

const SECONDARY_GOAL: Required<GoalColors> = {
  frame: "#000000",
  net: "#000000",
  ground: "#000000",
  background: "transparent",
  floor: "transparent",
};

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<T>;
}

export function resolvePitchColors(
  theme: Theme,
  overrides?: PitchColors,
): Required<PitchColors> {
  const base = theme === "primary" ? PRIMARY_PITCH : SECONDARY_PITCH;
  return { ...base, ...(overrides ? stripUndefined(overrides) : {}) };
}

export function resolveGoalColors(
  theme: Theme,
  overrides?: GoalColors,
): Required<GoalColors> {
  const base = theme === "primary" ? PRIMARY_GOAL : SECONDARY_GOAL;
  return { ...base, ...(overrides ? stripUndefined(overrides) : {}) };
}

/**
 * Named pitch presets — publishable looks bundled as one shorthand prop.
 *
 * - `green`  classic broadcast green, white lines
 * - `dark`   slate for dark UIs, bright lines
 * - `outline` white pitch with dark lines (editorial / docs default)
 *
 * Charts that accept `pitchPreset` resolve it to a `{ theme, colors }` pair
 * before rendering. Explicit `pitchTheme` and `pitchColors` props always win.
 */
export type PitchPreset = "green" | "dark" | "outline";

type PitchPresetConfig = {
  theme: Theme;
  colors: Required<PitchColors>;
};

const PITCH_PRESETS: Record<PitchPreset, PitchPresetConfig> = {
  green: {
    theme: "primary",
    colors: { fill: "#2d8a4e", lines: "#ffffffcc", markings: "#ffffff55" },
  },
  dark: {
    theme: "secondary",
    colors: { fill: "#1e293b", lines: "#f8fafc", markings: "#f8fafc44" },
  },
  outline: {
    theme: "primary",
    colors: { fill: "#ffffff", lines: "#1a1a1a", markings: "#1a1a1a44" },
  },
};

export const DEFAULT_PITCH_PRESET: PitchPreset = "outline";

/**
 * Resolve preset / theme / colors props to a concrete `{ theme, colors }`
 * config. Precedence:
 *
 * 1. `preset` — the canonical look (preferred public API)
 * 2. `theme` alone (no preset) — legacy shorthand: `primary` → green look,
 *    `secondary` → dark look
 * 3. neither — DEFAULT_PITCH_PRESET (outline)
 *
 * `colorsOverride` is merged on top of whichever base wins.
 */
export function resolvePitchPreset(
  preset?: PitchPreset,
  themeOverride?: Theme,
  colorsOverride?: PitchColors,
): { theme: Theme; colors: Required<PitchColors> } {
  let base: PitchPresetConfig;
  if (preset != null) {
    base = PITCH_PRESETS[preset];
  } else if (themeOverride != null) {
    base = themeOverride === "secondary" ? PITCH_PRESETS.dark : PITCH_PRESETS.green;
  } else {
    base = PITCH_PRESETS[DEFAULT_PITCH_PRESET];
  }
  const colors = {
    ...base.colors,
    ...(colorsOverride ? stripUndefined(colorsOverride) : {}),
  };
  return { theme: base.theme, colors };
}
