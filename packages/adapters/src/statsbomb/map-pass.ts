import type { PassEvent } from "@withqwerty/campos-schema";

import { statsBombToCampos } from "../shared/coordinates.js";
import type { StatsBombEvent, StatsBombMatchInfo, StatsBombPass } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Pass type classification
// ---------------------------------------------------------------------------

export function mapPassType(pass: StatsBombPass): PassEvent["passType"] {
  // Specific set-piece types first
  if (pass.type?.name === "Corner") return "corner";
  if (pass.type?.name === "Free Kick") return "free-kick";
  if (pass.type?.name === "Goal Kick") return "goal-kick";
  if (pass.type?.name === "Throw-in") return "throw-in";
  if (pass.type?.name === "Kick Off") return "kick-off";

  // Tactical pass types
  if (pass.through_ball) return "through-ball";
  if (pass.cross) return "cross";

  // Height-based classification
  if (pass.height.name === "Ground Pass") return "ground";
  if (pass.height.name === "Low Pass") return "low";
  if (pass.height.name === "High Pass") return "high";

  return "ground";
}

// ---------------------------------------------------------------------------
// Pass result
// ---------------------------------------------------------------------------

function mapPassResult(pass: StatsBombPass): PassEvent["passResult"] {
  if (!pass.outcome) return "complete";
  const name = pass.outcome.name;
  if (name === "Incomplete" || name === "Unknown") return "incomplete";
  if (name === "Out") return "out";
  if (name === "Pass Offside") return "offside";
  return "incomplete";
}

// ---------------------------------------------------------------------------
// End-coordinate normalization
// ---------------------------------------------------------------------------

function normalizeEndCoordinates(pass: StatsBombPass): Pick<PassEvent, "endX" | "endY"> {
  const [rawEndX, rawEndY] = pass.end_location;
  const campos = statsBombToCampos(rawEndX, rawEndY);
  return { endX: campos.x, endY: campos.y };
}

// ---------------------------------------------------------------------------
// Length and angle
// ---------------------------------------------------------------------------

/**
 * Scale StatsBomb pass length (yards on 120-yard pitch) to Campos units (0-100).
 */
function scaleLength(sbLength: number): number {
  return Math.round(sbLength * (100 / 120) * 100) / 100;
}

function computeLengthAndAngle(pass: StatsBombPass): Pick<PassEvent, "length" | "angle"> {
  return {
    length: scaleLength(pass.length),
    angle: Math.round(pass.angle * 10000) / 10000,
  };
}

// ---------------------------------------------------------------------------
// Pass builder
// ---------------------------------------------------------------------------

export function mapPass(event: StatsBombEvent, matchInfo: StatsBombMatchInfo): PassEvent {
  if (!event.pass) {
    throw new Error(`mapPass called on event ${event.id} without pass data`);
  }
  const pass = event.pass;
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);
  const endCoords = normalizeEndCoordinates(pass);
  const { length, angle } = computeLengthAndAngle(pass);

  return {
    kind: "pass" as const,
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
    endX: endCoords.endX,
    endY: endCoords.endY,
    length,
    angle,
    recipient: pass.recipient?.name ?? null,
    passResult: mapPassResult(pass),
    passType: mapPassType(pass),
    isAssist: pass.goal_assist === true,
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      passType: pass.type?.name,
      height: pass.height.name,
      playPattern: event.play_pattern.name,
    },
  };
}
