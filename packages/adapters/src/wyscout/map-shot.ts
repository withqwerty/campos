import type { ShotEvent } from "@withqwerty/campos-schema";

import type { WyscoutEvent } from "./parse.js";
import { baseEventFields, hasTag, normalizePoint } from "./common.js";

const TAG = {
  GOAL: 101,
  OWN_GOAL: 102,
  LEFT_FOOT: 401,
  RIGHT_FOOT: 402,
  HEAD_BODY: 403,
  DIRECT: 1101,
  COUNTER_ATTACK: 1901,
  BLOCKED: 2101,
} as const;

const SHOT_ON_GOAL_TAGS = new Set([1201, 1202, 1203, 1204, 1205, 1206, 1207, 1208, 1209]);
const SHOT_OFF_TARGET_TAGS = new Set([1210, 1211, 1212, 1213, 1214, 1215, 1216]);
const SHOT_POST_TAGS = new Set([1217, 1218, 1219, 1220, 1221, 1222, 1223]);

const GOAL_MOUTH_BY_TAG = new Map<number, { y: number; z: number }>([
  [1201, { y: 50, z: 0 }],
  [1202, { y: 55, z: 0 }],
  [1203, { y: 50, z: 1 }],
  [1204, { y: 45, z: 1 }],
  [1205, { y: 45, z: 0 }],
  [1206, { y: 55, z: 1 }],
  [1207, { y: 50, z: 2 }],
  [1208, { y: 45, z: 2 }],
  [1209, { y: 55, z: 2 }],
  [1210, { y: 60, z: 0 }],
  [1211, { y: 40, z: 1 }],
  [1212, { y: 40, z: 0 }],
  [1213, { y: 60, z: 1 }],
  [1214, { y: 50, z: 3.5 }],
  [1215, { y: 40, z: 3.5 }],
  [1216, { y: 60, z: 3.5 }],
  [1217, { y: 55.38, z: 0 }],
  [1218, { y: 44.62, z: 1 }],
  [1219, { y: 44.62, z: 0 }],
  [1220, { y: 55.38, z: 1 }],
  [1221, { y: 50, z: 2.77 }],
  [1222, { y: 44.62, z: 2 }],
  [1223, { y: 55.38, z: 2 }],
]);

function findGoalMouth(event: WyscoutEvent): { y: number; z: number } | null {
  for (const tag of event.tags) {
    const mapped = GOAL_MOUTH_BY_TAG.get(tag.id);
    if (mapped != null) {
      return mapped;
    }
  }
  return null;
}

function mapOutcome(event: WyscoutEvent): ShotEvent["outcome"] {
  if (hasTag(event, TAG.GOAL)) {
    return "goal";
  }
  if (hasTag(event, TAG.BLOCKED)) {
    return "blocked";
  }
  if (event.tags.some((tag) => SHOT_POST_TAGS.has(tag.id))) {
    return "hit-woodwork";
  }
  if (event.tags.some((tag) => SHOT_OFF_TARGET_TAGS.has(tag.id))) {
    return "off-target";
  }
  if (event.tags.some((tag) => SHOT_ON_GOAL_TAGS.has(tag.id))) {
    return "saved";
  }
  return "other";
}

function mapBodyPart(event: WyscoutEvent): ShotEvent["bodyPart"] {
  if (hasTag(event, TAG.HEAD_BODY)) {
    return "head";
  }
  if (hasTag(event, TAG.LEFT_FOOT)) {
    return "left-foot";
  }
  if (hasTag(event, TAG.RIGHT_FOOT)) {
    return "right-foot";
  }
  return "other";
}

function mapContext(event: WyscoutEvent): ShotEvent["context"] {
  if (event.subEventId === 35) {
    return "penalty";
  }
  if (event.subEventId === 33 && hasTag(event, TAG.DIRECT)) {
    return "direct-free-kick";
  }
  if (event.eventId === 3) {
    return "set-piece";
  }
  if (hasTag(event, TAG.COUNTER_ATTACK)) {
    return "fast-break";
  }
  return "regular-play";
}

export function isOwnGoal(event: WyscoutEvent): boolean {
  return hasTag(event, TAG.OWN_GOAL);
}

function shotEndFromPositions(event: WyscoutEvent): {
  endX: number | null;
  endY: number | null;
} {
  if (event.positions.length < 2) {
    return { endX: null, endY: null };
  }
  const end = normalizePoint(event.positions[1]);
  if (end == null) {
    return { endX: null, endY: null };
  }
  return { endX: end.x, endY: end.y };
}

export function mapShot(event: WyscoutEvent, matchId: string): ShotEvent {
  const base = baseEventFields(event, matchId);
  const goalMouth = findGoalMouth(event);
  const endCoords = shotEndFromPositions(event);

  return {
    kind: "shot",
    ...base,
    ...(endCoords.endX != null && endCoords.endY != null
      ? { endX: endCoords.endX, endY: endCoords.endY }
      : {}),
    xg: null,
    xgot: null,
    outcome: mapOutcome(event),
    bodyPart: mapBodyPart(event),
    isOwnGoal: isOwnGoal(event),
    isPenalty: event.subEventId === 35,
    context: mapContext(event),
    goalMouthY: goalMouth?.y ?? null,
    goalMouthZ: goalMouth?.z ?? null,
  };
}
