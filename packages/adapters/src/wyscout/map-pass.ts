import type { PassEvent } from "@withqwerty/campos-schema";

import { computePassLengthAndAngle } from "../shared/pass-geometry.js";
import type { WyscoutEvent } from "./parse.js";
import { baseEventFields, hasTag, normalizePoint } from "./common.js";

const TAG = {
  ASSIST: 301,
  HIGH: 801,
  THROUGH: 901,
  ACCURATE: 1801,
  INACCURATE: 1802,
} as const;

function mapPassType(event: WyscoutEvent): PassEvent["passType"] {
  if (event.subEventId === 80) {
    return "cross";
  }

  if (hasTag(event, TAG.THROUGH)) {
    return "through-ball";
  }

  if (event.subEventId === 83 || event.subEventId === 84 || hasTag(event, TAG.HIGH)) {
    return "high";
  }

  return "ground";
}

export function mapPass(event: WyscoutEvent, matchId: string): PassEvent {
  const base = baseEventFields(event, matchId);
  const start = normalizePoint(event.positions[0]);
  const end = normalizePoint(event.positions[1]);
  const { length, angle } = computePassLengthAndAngle(start?.x, start?.y, end?.x, end?.y);

  return {
    kind: "pass",
    ...base,
    x: start?.x ?? null,
    y: start?.y ?? null,
    endX: end?.x ?? null,
    endY: end?.y ?? null,
    length,
    angle,
    recipient: null,
    passResult: hasTag(event, TAG.ACCURATE)
      ? "complete"
      : hasTag(event, TAG.INACCURATE)
        ? "incomplete"
        : null,
    passType: mapPassType(event),
    isAssist: hasTag(event, TAG.ASSIST),
  };
}
