import {
  BOX_Y_MAX,
  BOX_Y_MIN,
  CHANNEL_EDGE_HIGH,
  CHANNEL_EDGE_LOW,
  OPPOSITION_BOX_X_MIN,
  OWN_BOX_X_MAX,
  THIRD_EDGE_HIGH,
  THIRD_EDGE_LOW,
} from "./geometry/camposZones.js";

/**
 * Zone predicates over Campos canonical coordinates (attacker-perspective,
 * `x: 0 = own goal → 100 = opposition goal`, `y: 0 = attacker's right →
 * 100 = attacker's left`).
 *
 * These helpers filter events by *pitch region* without asking the caller
 * to remember which x or y ranges define each zone. Pair them with
 * {@link partitionByZone} to split an event stream into named buckets.
 *
 * Event shape: any `{ x?, y?, endX?, endY? }` object (PassEvent, Shot,
 * Carry, etc.). Events missing the relevant coordinate are always `false`
 * so predicates never throw on missing data.
 *
 * Edge constants (`THIRD_EDGE_*`, `CHANNEL_EDGE_*`, `OPPOSITION_BOX_X_MIN`,
 * etc.) live in `geometry/camposZones.ts` and are re-exported below.
 */

export {
  BOX_Y_MAX,
  BOX_Y_MIN,
  CHANNEL_EDGE_HIGH,
  CHANNEL_EDGE_LOW,
  OPPOSITION_BOX_X_MIN,
  OWN_BOX_X_MAX,
  THIRD_EDGE_HIGH,
  THIRD_EDGE_LOW,
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PitchThird = "defensive" | "middle" | "attacking";
export type PitchChannel = "left" | "center" | "right";
export type PitchBox = "own" | "opposition";

/** Minimal event shape the predicates and partitioner accept. */
export type ZoneEventCoords = {
  x?: number | null;
  y?: number | null;
  endX?: number | null;
  endY?: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thirdFromX(x: number): PitchThird {
  if (x < THIRD_EDGE_LOW) return "defensive";
  if (x < THIRD_EDGE_HIGH) return "middle";
  return "attacking";
}

function channelFromY(y: number): PitchChannel {
  if (y < CHANNEL_EDGE_LOW) return "right";
  if (y < CHANNEL_EDGE_HIGH) return "center";
  return "left";
}

function inBox(x: number, y: number, which: PitchBox): boolean {
  if (y < BOX_Y_MIN || y > BOX_Y_MAX) return false;
  if (which === "opposition") return x >= OPPOSITION_BOX_X_MIN;
  return x <= OWN_BOX_X_MAX;
}

// ---------------------------------------------------------------------------
// Public predicates
// ---------------------------------------------------------------------------

/** Returns a predicate that matches events whose starting x lies in the given third. */
export function startsInThird(third: PitchThird) {
  return (event: ZoneEventCoords): boolean => {
    if (event.x == null) return false;
    return thirdFromX(event.x) === third;
  };
}

/** Returns a predicate that matches events whose end x lies in the given third. */
export function endsInThird(third: PitchThird) {
  return (event: ZoneEventCoords): boolean => {
    if (event.endX == null) return false;
    return thirdFromX(event.endX) === third;
  };
}

/** Returns a predicate that matches events whose starting y lies in the given channel. */
export function startsInChannel(channel: PitchChannel) {
  return (event: ZoneEventCoords): boolean => {
    if (event.y == null) return false;
    return channelFromY(event.y) === channel;
  };
}

/** Returns a predicate that matches events whose end y lies in the given channel. */
export function endsInChannel(channel: PitchChannel) {
  return (event: ZoneEventCoords): boolean => {
    if (event.endY == null) return false;
    return channelFromY(event.endY) === channel;
  };
}

/** Returns a predicate that matches events whose starting (x, y) lies in the named penalty box. */
export function startsInBox(box: PitchBox) {
  return (event: ZoneEventCoords): boolean => {
    if (event.x == null || event.y == null) return false;
    return inBox(event.x, event.y, box);
  };
}

/** Returns a predicate that matches events whose end (endX, endY) lies in the named penalty box. */
export function endsInBox(box: PitchBox) {
  return (event: ZoneEventCoords): boolean => {
    if (event.endX == null || event.endY == null) return false;
    return inBox(event.endX, event.endY, box);
  };
}

// ---------------------------------------------------------------------------
// Partitioning
// ---------------------------------------------------------------------------

/**
 * Partition events into named buckets using zone predicates. Each event is
 * assigned to the **first** predicate it matches; events that match no
 * predicate are dropped. Use this to split a pass stream into thirds,
 * channels, or any custom region set in a single pass.
 *
 * @example
 * ```ts
 * import { partitionByZone, startsInThird } from "@withqwerty/campos-stadia";
 *
 * const { defensive, middle, attacking } = partitionByZone(passes, {
 *   defensive: startsInThird("defensive"),
 *   middle: startsInThird("middle"),
 *   attacking: startsInThird("attacking"),
 * });
 * ```
 */
export function partitionByZone<E extends ZoneEventCoords, K extends string>(
  events: readonly E[],
  predicates: Record<K, (event: E) => boolean>,
): Record<K, E[]> {
  const keys = Object.keys(predicates) as K[];
  const out = {} as Record<K, E[]>;
  for (const key of keys) {
    out[key] = [];
  }
  for (const event of events) {
    for (const key of keys) {
      if (predicates[key](event)) {
        out[key].push(event);
        break;
      }
    }
  }
  return out;
}
