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
  fill: "#1a472a",
  lines: "#ffffffcc",
  markings: "#ffffff55",
};

// Secondary: dark/muted pitch
const SECONDARY_PITCH: Required<PitchColors> = {
  fill: "#12141a",
  lines: "#2a2e38",
  markings: "#2a2e3880",
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
