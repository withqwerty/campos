import type { ShotEvent } from "@withqwerty/campos-schema";

import { statsBombToCampos } from "../shared/coordinates.js";
import type { StatsBombEvent, StatsBombMatchInfo, StatsBombShot } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Goal-mouth coordinate helpers
// ---------------------------------------------------------------------------

/** StatsBomb goal posts sit at y=36 and y=44 on the 80-yard pitch. */
const GOAL_POST_LEFT_Y = 36;
const GOAL_POST_RIGHT_Y = 44;
const GOAL_WIDTH = GOAL_POST_RIGHT_Y - GOAL_POST_LEFT_Y;

/** Crossbar height in the same unit as end_location[2] (yards). */
const CROSSBAR_HEIGHT_YARDS = 2.67;

/**
 * Convert StatsBomb shot.end_location to goal-face percentages.
 *
 * goalMouthY: 0 = left post, 100 = right post (from shooter's perspective).
 * goalMouthZ: 0 = ground, 100 = crossbar.
 *
 * Returns null for either axis when end_location doesn't reach the goal
 * or the value falls outside the goal frame.
 */
function mapGoalMouth(shot: StatsBombShot): {
  goalMouthY: number | null;
  goalMouthZ: number | null;
} {
  const endY = shot.end_location[1];
  if (endY == null) return { goalMouthY: null, goalMouthZ: null };

  const crossGoal = ((endY - GOAL_POST_LEFT_Y) / GOAL_WIDTH) * 100;
  const goalMouthY =
    crossGoal >= 0 && crossGoal <= 100 ? Math.round(crossGoal * 10) / 10 : null;

  const endZ = shot.end_location[2];
  if (endZ == null) return { goalMouthY, goalMouthZ: null };

  const height = (endZ / CROSSBAR_HEIGHT_YARDS) * 100;
  const goalMouthZ = height >= 0 && height <= 100 ? Math.round(height * 10) / 10 : null;

  return { goalMouthY, goalMouthZ };
}

/**
 * StatsBomb `shot.end_location` is the ball position after the shot (toward goal, wide, etc.).
 * Map the horizontal plane to Campos pitch coordinates for trajectory rendering.
 */
function mapShotPitchEnd(shot: StatsBombShot): {
  endX: number | null;
  endY: number | null;
} {
  const loc = shot.end_location;
  if (loc.length < 2) {
    return { endX: null, endY: null };
  }
  const rawX = loc[0];
  const rawY = loc[1];
  if (typeof rawX !== "number" || typeof rawY !== "number") {
    return { endX: null, endY: null };
  }
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
    return { endX: null, endY: null };
  }
  const { x, y } = statsBombToCampos(rawX, rawY);
  return { endX: x, endY: y };
}

// ---------------------------------------------------------------------------
// Field mappers
// ---------------------------------------------------------------------------

export function mapOutcome(outcomeName: string): ShotEvent["outcome"] {
  switch (outcomeName) {
    case "Goal":
      return "goal";
    case "Saved":
    case "Saved Off Target":
    case "Saved to Post":
      return "saved";
    case "Blocked":
      return "blocked";
    case "Off T":
    case "Wayward":
      return "off-target";
    case "Post":
      return "hit-woodwork";
    default:
      return "other";
  }
}

export function mapBodyPart(bodyPartName: string): ShotEvent["bodyPart"] {
  switch (bodyPartName) {
    case "Left Foot":
      return "left-foot";
    case "Right Foot":
      return "right-foot";
    case "Head":
      return "head";
    default:
      return "other";
  }
}

export function mapContext(
  shot: StatsBombShot,
  playPatternName: string,
): ShotEvent["context"] {
  // Shot type takes precedence
  if (shot.type.name === "Penalty") return "penalty";
  if (shot.type.name === "Free Kick") return "direct-free-kick";

  // Then play pattern
  if (playPatternName === "From Corner") return "from-corner";
  if (playPatternName === "From Free Kick") return "set-piece";
  if (playPatternName === "From Counter") return "fast-break";

  return "regular-play";
}

// ---------------------------------------------------------------------------
// Shot builder
// ---------------------------------------------------------------------------

/**
 * StatsBomb match metadata exposes `shot_fidelity_version` (1 or 2) per match.
 * v2 guarantees high-fidelity decimals for shots, freeze frames, and events
 * paired to shots; v1 is integer-ish. The adapter treats both identically —
 * `statsBombToCampos` is a linear affine and goal-mouth clamping in
 * `mapGoalMouth` handles endpoints that sail above the crossbar (common in v1
 * endpoint data). Consumers that need to filter by fidelity should read the
 * match metadata directly.
 */
export function mapShot(event: StatsBombEvent, matchInfo: StatsBombMatchInfo): ShotEvent {
  if (!event.shot) {
    throw new Error(`mapShot called on event ${event.id} without shot data`);
  }
  const shot = event.shot;
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  return {
    kind: "shot" as const,
    id: `${matchInfo.id}:${event.id}`,
    matchId: String(matchInfo.id),
    teamId: String(event.team.id),
    playerId: event.player ? String(event.player.id) : null,
    playerName: event.player?.name ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coordinates.x,
    y: coordinates.y,
    xg: shot.statsbomb_xg,
    xgot: null,
    outcome: mapOutcome(shot.outcome.name),
    bodyPart: mapBodyPart(shot.body_part.name),
    isOwnGoal:
      shot.type.name === "Own Goal For" ||
      shot.outcome.name === "Own Goal" ||
      shot.type.name === "Own Goal Against",
    isPenalty: shot.type.name === "Penalty",
    context: mapContext(shot, event.play_pattern.name),
    ...mapGoalMouth(shot),
    ...mapShotPitchEnd(shot),
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      shotType: shot.type.name,
      technique: shot.technique?.name,
      playPattern: event.play_pattern.name,
    },
  };
}
