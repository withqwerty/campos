import { statsBombToCampos } from "../shared/coordinates.js";
import type { StatsBombMatchInfo, StatsBombThreeSixtyFrame } from "./parse.js";

export type StatsBombFreezeFrameParticipant = {
  /** Stable only within this event-linked snapshot; not a player identifier. */
  id: string;
  side: "teammate" | "opponent";
  isActor: boolean;
  isKeeper: boolean;
  x: number;
  y: number;
};

export type StatsBombFreezeFrame = {
  id: string;
  matchId: string;
  /** Raw StatsBomb event UUID, suitable for joining to `providerEventId`. */
  eventId: string;
  coordinateFrame: "event-attacking";
  participants: StatsBombFreezeFrameParticipant[];
  /** Visible-camera polygon in the same event-attacking Campos coordinate frame. */
  visibleArea: { x: number; y: number }[] | null;
  provider: "statsbomb";
  providerFrameId: string;
};

function projectPoint(location: readonly number[] | null | undefined): {
  x: number;
  y: number;
} | null {
  const x = location?.[0];
  const y = location?.[1];
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return statsBombToCampos(x, y);
}

function mapVisibleArea(
  raw: readonly number[] | null | undefined,
): { x: number; y: number }[] | null {
  if (raw == null || raw.length === 0 || raw.length % 2 !== 0) return null;

  const visibleArea: { x: number; y: number }[] = [];
  for (let index = 0; index < raw.length; index += 2) {
    const x = raw[index];
    const y = raw[index + 1];
    if (x == null || y == null) return null;
    const point = projectPoint([x, y]);
    if (point == null) return null;
    visibleArea.push(point);
  }
  return visibleArea;
}

/**
 * Normalise StatsBomb 360 records without inventing player identities.
 *
 * 360 coordinates are oriented to the linked event's attacking direction, so
 * this output intentionally uses an event-attacking frame rather than the
 * absolute `TrackingFrameSnapshot` contract used by continuous tracking.
 */
export function mapStatsBombFreezeFrame(
  frame: StatsBombThreeSixtyFrame,
  matchInfo: StatsBombMatchInfo,
): StatsBombFreezeFrame {
  if (frame.event_uuid.length === 0) {
    throw new Error("StatsBomb 360 frame requires a non-empty event_uuid.");
  }

  const participants: StatsBombFreezeFrameParticipant[] = [];
  for (const [index, participant] of (frame.freeze_frame ?? []).entries()) {
    const point = projectPoint(participant.location);
    if (point == null) continue;
    participants.push({
      id: `${frame.event_uuid}:${index}`,
      side: participant.teammate === true ? "teammate" : "opponent",
      isActor: participant.actor === true,
      isKeeper: participant.keeper === true,
      ...point,
    });
  }

  return {
    id: `${matchInfo.id}:statsbomb:freeze-frame:${frame.event_uuid}`,
    matchId: String(matchInfo.id),
    eventId: frame.event_uuid,
    coordinateFrame: "event-attacking",
    participants,
    visibleArea: mapVisibleArea(frame.visible_area),
    provider: "statsbomb",
    providerFrameId: frame.event_uuid,
  };
}

export function mapStatsBombFreezeFrames(
  frames: readonly StatsBombThreeSixtyFrame[],
  matchInfo: StatsBombMatchInfo,
): StatsBombFreezeFrame[] {
  return frames.map((frame) => mapStatsBombFreezeFrame(frame, matchInfo));
}
