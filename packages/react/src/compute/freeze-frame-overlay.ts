export type FreezeFramePoint = {
  x: number;
  y: number;
};

export type FreezeFrameParticipant = FreezeFramePoint & {
  /** Unique only within the event-linked freeze frame. */
  id: string;
  side: "teammate" | "opponent";
  isActor: boolean;
  isKeeper: boolean;
};

export type EventFreezeFrame = {
  participants: readonly FreezeFrameParticipant[];
  visibleArea: readonly FreezeFramePoint[] | null;
};

export type FreezeFrameParticipantMark = FreezeFrameParticipant & {
  ariaLabel: string;
};

export type FreezeFrameScene = {
  participants: FreezeFrameParticipantMark[];
  visibleArea: readonly FreezeFramePoint[] | null;
  accessibleLabel: string;
  emptyMessage: string | null;
};

/**
 * Prepares a renderer-safe event-linked freeze frame. Unlike continuous
 * tracking, participant IDs are only required to be unique inside one frame.
 */
export function buildFreezeFrameScene(frame: EventFreezeFrame): FreezeFrameScene {
  const seenIds = new Set<string>();
  const participants = frame.participants.map((participant) => {
    if (seenIds.has(participant.id)) {
      throw new Error(
        `FreezeFrameOverlay requires unique participant ids; duplicate ${participant.id}.`,
      );
    }
    seenIds.add(participant.id);

    const role = participant.isActor
      ? "actor"
      : participant.isKeeper
        ? "goalkeeper"
        : "player";
    return {
      ...participant,
      ariaLabel: `${participant.side} ${role}`,
    };
  });

  const emptyMessage =
    participants.length === 0 ? "No participants in this freeze frame." : null;
  const visibleAreaLabel =
    frame.visibleArea == null ? "camera area unavailable" : "camera area shown";
  return {
    participants,
    visibleArea: frame.visibleArea,
    accessibleLabel: `Event freeze frame, ${participants.length} participants, ${visibleAreaLabel}.${
      emptyMessage == null ? "" : ` ${emptyMessage}`
    }`,
    emptyMessage,
  };
}
