import type {
  FormationKey,
  FormationPlayer,
  FormationPositionEntry,
  FormationTeamData,
} from "@withqwerty/campos-schema";
import {
  allFormationKeys,
  getFormationPositions,
  getFormationSlot,
  getMplSlotForOptaSlot,
  isValidFormationKey,
  parseFormationKey,
} from "@withqwerty/campos-schema";
import { deriveInitials } from "./pass-network-transforms.js";
export {
  allFormationKeys,
  getFormationPositions,
  getFormationSlot,
  getMplSlotForOptaSlot,
  isValidFormationKey,
  parseFormationKey,
};
export type { FormationKey, FormationPlayer, FormationPositionEntry, FormationTeamData };

/**
 * Historic alias retained for readability inside the formation package.
 * Matches the canonical `AttackingDirection` used by Pitch / ShotMap / etc.
 */
export type FormationOrientation = "up" | "down" | "left" | "right";
export type FormationCrop = "full" | "half";
export type FormationHalfSide = "attack" | "defend";

export function isVerticalFormation(direction: FormationOrientation): boolean {
  return direction === "up" || direction === "down";
}

export type FormationLayoutOptions = {
  attackingDirection: FormationOrientation;
  crop: FormationCrop;
  /**
   * Which half of the pitch the visible half crop represents. Only consulted
   * when `crop === "half"`. `"attack"` compresses the formation into
   * Campos x [50, 100]; `"defend"` compresses it into [0, 50].
   */
  side?: FormationHalfSide;
  /**
   * Mirror the formation along the attacking axis before crop compression.
   * Renderers project that axis vertically or horizontally, so this single
   * coordinate transform becomes top/bottom flipping on vertical pitches and
   * left/right flipping on horizontal pitches.
   */
  flip?: boolean;
};

/**
 * Touchline inset (in Campos y units) applied when placing widest players.
 * Pitch base positions reach y ∈ [10, 90] (approx.), but some formations
 * (e.g. 4-2-3-1) stretch wingers to y=10/90 which sits flush with the
 * touchline and makes the marker clip the pitch edge. Inset moves players
 * slightly inward so the marker has breathing room.
 */
const TOUCHLINE_INSET = 6;

function insetTouchline(y: number): number {
  // Compress the 0..100 width band into [INSET, 100-INSET] linearly.
  return TOUCHLINE_INSET + (y / 100) * (100 - 2 * TOUCHLINE_INSET);
}

export type RenderedFormationSlot = {
  /** 1-indexed slot number */
  slot: number;
  /** mplsoccer canonical position code (or explicit override from the player) */
  positionCode: string;
  /** Campos pitch x coordinate 0..100, after flip/crop transforms */
  x: number;
  /** Campos pitch y coordinate 0..100; orientation is applied by the renderer */
  y: number;
  /** The assigned player, if any */
  player?: FormationPlayer;
  /** True when no player was assigned (renders as dashed placeholder) */
  placeholder: boolean;
};

export type SingleTeamLayoutResult = {
  slots: RenderedFormationSlot[];
};

/**
 * Apply crop transforms and touchline insets to a base position.
 *
 * The base position table (formation-positions.json) is authored directly in
 * Campos canonical coordinates: x is always the attacking axis (x=0 own goal,
 * x=100 opposition goal), y is always the pitch width. GK sits at x ~= 10,
 * attackers at x ~= 90.
 *
 * Orientation is a *view* concern, not a data concern — the stadia Pitch
 * projection (`createPitchProjection`) handles vertical/horizontal rotation
 * when drawing, so this function does NOT rotate coordinates. Doing so here
 * would rotate twice and land the GK on the left touchline of a vertical
 * pitch instead of at the bottom.
 *
 * `flip` mirrors the formation along that attacking axis before crop
 * compression. Projection turns that into a vertical top/bottom flip or a
 * horizontal left/right flip depending on the rendered pitch orientation.
 *
 * `crop="half"` then compresses the attacking axis into the visible pitch
 * half without changing the selected side: `side="attack"` maps into
 * x ∈ [50, 100], while `side="defend"` maps into x ∈ [0, 50]. Formation's
 * React API chooses a default `flip` for half crops so the goalkeeper stays
 * inside the visible penalty area.
 *
 * A touchline inset of {@link TOUCHLINE_INSET} units is applied after the
 * crop so widest players (wingers, full-backs) have breathing room
 * against the pitch edge.
 */
export function applyOrientationAndCrop(
  x: number,
  y: number,
  options: FormationLayoutOptions,
): { x: number; y: number } {
  let rx = options.flip === true ? 100 - x : x;
  let ry = y;
  const side: FormationHalfSide = options.side ?? "attack";
  if (options.crop === "half") {
    // Attacking axis is always x in Campos coords.
    if (side === "attack") {
      rx = 50 + rx / 2;
    } else {
      rx = rx / 2;
    }
  }
  // Apply a slight touchline inset so wingers don't sit flush to the
  // sideline and clip the marker.
  ry = insetTouchline(ry);
  return { x: rx, y: ry };
}

/**
 * Layout a single team onto the full pitch.
 *
 * The base position table is in Campos canonical coordinates: x is the
 * attacking axis (GK at low x), y is the width axis. Orientation is left to
 * the renderer projection. For "half" crop we compress the attacking axis
 * into the selected visible half of the pitch.
 *
 * Variable-slot formations are honoured: e.g., '44' has 9 slots, '342' has 10.
 * `team.players.length` must be <= `positions.length` for the given formation.
 */
export function layoutSingleTeam(
  team: FormationTeamData,
  options: FormationLayoutOptions,
): SingleTeamLayoutResult {
  const key = parseFormationKey(team.formation);
  const positions = getFormationPositions(key);
  const maxSlot = positions.length;

  if (team.players.length > maxSlot) {
    throw new Error(
      `at most ${maxSlot} players allowed in formation ${key}, got ${team.players.length}`,
    );
  }

  // Assign players to slots.
  // 1. Players with explicit `slot` win that slot.
  // 2. Remaining players fill the unassigned slots in array order.
  const bySlot = new Map<number, FormationPlayer>();
  const unassigned: FormationPlayer[] = [];
  for (const p of team.players) {
    if (p.slot != null) {
      if (!Number.isInteger(p.slot) || p.slot < 1 || p.slot > maxSlot) {
        throw new Error(
          `player slot must be an integer between 1 and ${maxSlot} in formation ${key}, got ${p.slot}`,
        );
      }
      if (bySlot.has(p.slot)) {
        throw new Error(`two players assigned to slot ${p.slot}`);
      }
      bySlot.set(p.slot, p);
    } else {
      unassigned.push(p);
    }
  }
  let unassignedCursor = 0;
  for (let slot = 1; slot <= maxSlot; slot += 1) {
    if (!bySlot.has(slot) && unassignedCursor < unassigned.length) {
      const next = unassigned[unassignedCursor];
      if (next !== undefined) {
        bySlot.set(slot, next);
      }
      unassignedCursor += 1;
    }
  }

  const slots: RenderedFormationSlot[] = positions.map((pos) => {
    const player = bySlot.get(pos.slot);
    // Prefer explicit per-player (x, y) overrides from adapters that supply
    // exact coordinates (e.g. WhoScored's formationPositions). Fall back to
    // the mplsoccer table when the override is absent.
    const baseX = player?.x ?? pos.x;
    const baseY = player?.y ?? pos.y;
    const transformed = applyOrientationAndCrop(baseX, baseY, options);
    const positionCode = player?.positionCode ?? pos.code;
    const base: RenderedFormationSlot = {
      slot: pos.slot,
      positionCode,
      x: transformed.x,
      y: transformed.y,
      placeholder: player == null,
    };
    if (player !== undefined) {
      base.player = player;
    }
    return base;
  });

  return { slots };
}

export type DualTeamLayoutResult = {
  home: SingleTeamLayoutResult;
  away: SingleTeamLayoutResult;
};

/**
 * Layout two teams on one vertical pitch in broadcast-style lineup
 * card format.
 *
 * - Home team occupies the defensive half in Campos coords (x < 50). Home
 *   GK sits at low x (x ~= 4), home attackers approach the halfway line
 *   (x ~= 48). On a vertical pitch this renders the home team in the
 *   bottom half of the screen.
 * - Away team occupies the attacking half (x > 50), mirrored. Away GK
 *   sits at high x (x ~= 96), away attackers approach the halfway line
 *   (x ~= 52). On a vertical pitch this renders the away team in the
 *   top half of the screen.
 * - Both teams use the full pitch width (y) for lateral spacing.
 * - Both teams use their own formation's shape independently.
 *
 * Core dual-team layout always emits full-pitch Campos coordinates. Renderers
 * choose vertical or horizontal projection later. It delegates to
 * `layoutSingleTeam` under the hood, so variable-slot formations (9/10/11)
 * are handled consistently and per-team player-count validation raises
 * formation-specific error messages.
 */
export function layoutDualTeam(
  home: FormationTeamData,
  away: FormationTeamData,
): DualTeamLayoutResult {
  // layoutTeamInHalf delegates to layoutSingleTeam which validates that
  // players.length does not exceed the formation's positions.length. Per-team
  // max-player checks are therefore formation-specific (9, 10, or 11 depending
  // on whether the key resolves to a historical/partial formation).
  const homeResult = layoutTeamInHalf(home, "home");
  const awayResult = layoutTeamInHalf(away, "away");
  return { home: homeResult, away: awayResult };
}

function layoutTeamInHalf(
  team: FormationTeamData,
  side: "home" | "away",
): SingleTeamLayoutResult {
  // Reuse the single-team layout, then compress the attacking axis (x) into
  // one half of the pitch. The base positions have x ranging roughly 10..90
  // (GK low, attackers high). We normalize to [0, 1] and scale+translate into
  // either [4, 48] (home, defensive half) or [52, 96] (away, attacking half).
  const base = layoutSingleTeam(team, { attackingDirection: "up", crop: "full" });
  const compressed: RenderedFormationSlot[] = base.slots.map((slot) => {
    const normalized = slot.x / 100;
    let newX: number;
    if (side === "home") {
      // home: defensive half (x < 50), GK at low x, attackers approach halfway
      newX = normalized * 44 + 4; // maps 0..1 -> 4..48
      newX = Math.min(48, newX);
    } else {
      // away: attacking half (x > 50), GK at high x (mirrored), attackers approach halfway
      newX = 100 - (normalized * 44 + 4); // maps 0..1 -> 96..52
      newX = Math.max(52, newX);
    }
    const next: RenderedFormationSlot = {
      slot: slot.slot,
      positionCode: slot.positionCode,
      x: newX,
      y: slot.y,
      placeholder: slot.placeholder,
    };
    if (slot.player !== undefined) {
      next.player = slot.player;
    }
    return next;
  });
  return { slots: compressed };
}

// ---------------------------------------------------------------------------
// Label derivation
// ---------------------------------------------------------------------------

/**
 * Strategy for choosing what text to render inside a formation slot marker.
 *
 * - `"auto"`: pick the most informative label available for each slot
 * - `"positionCode"`: force the mplsoccer position code (e.g., "GK", "CAM")
 * - `"jerseyNumber"`: force the jersey number; falls back to position code
 * - `"initials"`: force derived initials; falls back to position code
 * - `"name"`: force the player's display label; falls back to position code
 */
export type FormationLabelStrategy =
  | "auto"
  | "positionCode"
  | "jerseyNumber"
  | "initials"
  | "name";

/**
 * Resolved label text for a single formation slot.
 *
 * - `primary` is rendered inside the marker circle
 * - `secondary` (optional) is rendered below the marker as a broadcast-style
 *   name pill. Omitted when no secondary context is available.
 */
export type FormationLabel = {
  /** Text rendered inside the marker circle. */
  primary: string;
  /** Optional text rendered below the marker (broadcast-style name pill). */
  secondary?: string;
};

export type DeriveLabelInput = {
  slot: RenderedFormationSlot;
  strategy: FormationLabelStrategy;
};

/**
 * Derive the in-marker label and optional below-marker name for a slot,
 * honoring the label strategy.
 *
 * Strategy semantics:
 *   - `"auto"`: pick the most informative label available
 *       · no player → position code
 *       · player with number → number in marker, name below
 *       · player with name only → initials in marker, full name below
 *       · player with neither → position code
 *   - explicit strategies force a specific source, falling back to the
 *     position code if the requested source is missing. When a name is
 *     available it is surfaced as `secondary` so renderers can still show
 *     a broadcast-style pill.
 */
export function deriveFormationLabel(input: DeriveLabelInput): FormationLabel {
  const { slot, strategy } = input;
  const player = slot.player;

  switch (strategy) {
    case "auto": {
      if (!player) {
        return { primary: slot.positionCode };
      }
      if (player.number != null) {
        const base: FormationLabel = { primary: String(player.number) };
        if (player.label) {
          base.secondary = player.label;
        }
        return base;
      }
      if (player.label) {
        return { primary: deriveInitials(player.label), secondary: player.label };
      }
      return { primary: slot.positionCode };
    }

    case "positionCode": {
      const base: FormationLabel = { primary: slot.positionCode };
      if (player?.label) {
        base.secondary = player.label;
      }
      return base;
    }

    case "jerseyNumber": {
      if (player?.number != null) {
        const base: FormationLabel = { primary: String(player.number) };
        if (player.label) {
          base.secondary = player.label;
        }
        return base;
      }
      return { primary: slot.positionCode };
    }

    case "initials": {
      if (player?.label) {
        return { primary: deriveInitials(player.label), secondary: player.label };
      }
      return { primary: slot.positionCode };
    }

    case "name": {
      if (player?.label) {
        return { primary: player.label };
      }
      return { primary: slot.positionCode };
    }

    default: {
      // Exhaustiveness guard — new strategies must be handled above.
      const _never: never = strategy;
      throw new Error(`unknown formation label strategy: ${_never as string}`);
    }
  }
}
