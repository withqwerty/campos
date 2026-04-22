import type { PassEvent } from "@withqwerty/campos-schema";
import { meanBy, minBy } from "./math.js";
import type { PassNetworkEdge, PassNetworkNode } from "./pass-network.js";
import { deriveInitials } from "./pass-network-transforms.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PassNetworkTimeWindow =
  | "untilFirstSub"
  | "fullMatch"
  | readonly [number, number];

export type PassNetworkSubstitution = {
  /** Minute of the substitution. */
  minute: number;
  /** Optional team id — if provided, the helper can still use a sub from the other team as the first-sub marker. */
  teamId?: string;
};

export type AggregatePassNetworkOptions = {
  /** Team id to build the network for. Only passes where event.teamId matches are included. */
  teamId: string;
  /**
   * Time window:
   * - undefined (default): same as `"untilFirstSub"`, but silently falls
   *   back to full match when no substitutions are supplied so callers who
   *   do nothing don't get a warning.
   * - `"untilFirstSub"`: include passes up to the minute of the first
   *   substitution made by THIS team (subs with `teamId == null` also
   *   count). Warns and falls back to full match if no matching subs exist.
   * - `"fullMatch"`: include every pass from minute 0 to 120.
   * - `[start, end]`: include passes whose minute is in `[start, end]`.
   */
  timeWindow?: PassNetworkTimeWindow;
  /** Substitution events used by `"untilFirstSub"` (or the default). */
  substitutions?: readonly PassNetworkSubstitution[];
  /**
   * Minimum number of pass involvements (outgoing passes + incoming passes
   * received) for a player to appear as a node. Default: 5. Matches the
   * research-memo convention of "≥ N pass events" as the inclusion rule.
   * Node `passCount` remains the outgoing count only — matching the fan-
   * facing "X passes made" metric.
   */
  minPassesForNode?: number;
  /**
   * Minimum count for an edge to be returned.
   * Default: 0 (filtering happens in the chart via `minEdgePasses`).
   */
  minPassesForEdge?: number;
  /** Optional per-player xT resolver. Default: returns null. */
  xTForPlayer?: (playerName: string) => number | null;
  /** Optional per-pair xT resolver. Default: returns null. */
  xTForPair?: (sourceName: string, targetName: string) => number | null;
  /**
   * Optional override for how a player name becomes a chart label + tooltip
   * full name. Default: `deriveInitials(name)` as the short label with the
   * raw name as the tooltip value.
   */
  labelFor?: (playerName: string) => { label: string; labelFull: string };
};

export type AggregatePassNetworkResult = {
  nodes: PassNetworkNode[];
  edges: PassNetworkEdge[];
  warnings: readonly string[];
  /** Resolved time window as `[startMinute, endMinuteInclusive]`. */
  window: readonly [number, number];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWindow(
  timeWindow: PassNetworkTimeWindow | undefined,
  substitutions: readonly PassNetworkSubstitution[] | undefined,
  teamId: string,
  warnings: string[],
): readonly [number, number] {
  // Explicit fullMatch or explicit [start, end] ranges short-circuit.
  if (timeWindow === "fullMatch") {
    return [0, 120];
  }
  if (Array.isArray(timeWindow)) {
    return [timeWindow[0] as number, timeWindow[1] as number];
  }

  // Default (undefined) and explicit "untilFirstSub" both want the first sub
  // for THIS team. Only the explicit path warns on fallback — a silent
  // default-fallback avoids spamming consumers who did nothing.
  const isExplicit = timeWindow === "untilFirstSub";

  if (!substitutions || substitutions.length === 0) {
    if (isExplicit) {
      warnings.push(
        'timeWindow="untilFirstSub" was requested but no substitutions were supplied — falling back to fullMatch',
      );
    }
    return [0, 120];
  }

  // Team-scoped filter: consider substitutions where teamId matches this team,
  // or where teamId is absent (callers who don't care to tag them).
  const teamSubs = substitutions.filter((s) => s.teamId == null || s.teamId === teamId);
  if (teamSubs.length === 0) {
    if (isExplicit) {
      warnings.push(
        `timeWindow="untilFirstSub" requested but no substitutions matched teamId="${teamId}" — falling back to fullMatch`,
      );
    }
    return [0, 120];
  }

  const earliest = minBy(teamSubs, (s) => s.minute);
  if (earliest == null || !Number.isFinite(earliest)) {
    if (isExplicit) {
      warnings.push(
        'timeWindow="untilFirstSub" could not determine the first-sub minute — falling back to fullMatch',
      );
    }
    return [0, 120];
  }
  return [0, earliest];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Reduce raw pass events into a single team's passing network
 * (`{ nodes, edges }`) suitable for the `PassNetwork` chart.
 *
 * Node id convention: `playerName` is used as the stable identifier so the
 * helper works across adapters that populate player names (Opta, StatsBomb,
 * WhoScored) without requiring a `recipientId` schema addition. Wyscout —
 * which does not populate `playerName` — is not supported by this helper.
 *
 * Node position: mean of the (x, y) coordinates of every pass the player
 * made in the window PLUS the (endX, endY) of every pass where they were
 * the named recipient. This is the standard "average on-ball position"
 * used in the mplsoccer reference implementation.
 *
 * Edges: directional counts (A→B kept separate from B→A). The chart will
 * merge them if `directed=false`, or keep them if `directed=true`.
 */
export function aggregatePassNetwork(
  passes: readonly PassEvent[],
  options: AggregatePassNetworkOptions,
): AggregatePassNetworkResult {
  const warnings: string[] = [];
  const minPassesForNode = options.minPassesForNode ?? 5;
  const minPassesForEdge = options.minPassesForEdge ?? 0;
  const xTForPlayer = options.xTForPlayer ?? (() => null);
  const xTForPair = options.xTForPair ?? (() => null);
  const labelFor =
    options.labelFor ??
    ((name: string) => ({ label: deriveInitials(name), labelFull: name }));
  const [windowStart, windowEnd] = resolveWindow(
    options.timeWindow,
    options.substitutions,
    options.teamId,
    warnings,
  );

  // Pre-filter: correct team, within window, usable coordinates + names.
  type UsablePass = {
    playerName: string;
    recipient: string;
    x: number;
    y: number;
    endX: number;
    endY: number;
  };
  const usable: UsablePass[] = [];
  for (const p of passes) {
    if (p.teamId !== options.teamId) continue;
    if (p.minute < windowStart || p.minute > windowEnd) continue;
    if (p.playerName == null || p.playerName.length === 0) continue;
    if (p.recipient == null || p.recipient.length === 0) continue;
    if (p.x == null || !Number.isFinite(p.x)) continue;
    if (p.y == null || !Number.isFinite(p.y)) continue;
    if (p.endX == null || !Number.isFinite(p.endX)) continue;
    if (p.endY == null || !Number.isFinite(p.endY)) continue;
    usable.push({
      playerName: p.playerName,
      recipient: p.recipient,
      x: p.x,
      y: p.y,
      endX: p.endX,
      endY: p.endY,
    });
  }

  // Outgoing count (drives node.passCount, matches fan-facing "passes made").
  const outgoingCount = new Map<string, number>();
  // Incoming count (used only for the node-inclusion threshold).
  const incomingCount = new Map<string, number>();
  // Position samples per player: origin coords when passing, end coords when receiving.
  const positionSamples = new Map<string, { x: number; y: number }[]>();
  // Directed pair counts (A → B).
  const pairCounts = new Map<string, Map<string, number>>();

  for (const p of usable) {
    outgoingCount.set(p.playerName, (outgoingCount.get(p.playerName) ?? 0) + 1);
    incomingCount.set(p.recipient, (incomingCount.get(p.recipient) ?? 0) + 1);
    const passerSamples = positionSamples.get(p.playerName) ?? [];
    passerSamples.push({ x: p.x, y: p.y });
    positionSamples.set(p.playerName, passerSamples);
    const recipientSamples = positionSamples.get(p.recipient) ?? [];
    recipientSamples.push({ x: p.endX, y: p.endY });
    positionSamples.set(p.recipient, recipientSamples);
    const bucket = pairCounts.get(p.playerName) ?? new Map<string, number>();
    bucket.set(p.recipient, (bucket.get(p.recipient) ?? 0) + 1);
    pairCounts.set(p.playerName, bucket);
  }

  // Candidate players: anyone observed as passer or recipient.
  const candidateIds = new Set<string>();
  for (const p of usable) {
    candidateIds.add(p.playerName);
    candidateIds.add(p.recipient);
  }

  // A player is a node if their total pass involvements (outgoing + incoming)
  // meet minPassesForNode. This matches the research memo's "≥ N pass events"
  // rule and avoids dropping players who received many passes but made few.
  const nodeIds = new Set<string>();
  for (const id of candidateIds) {
    const total = (outgoingCount.get(id) ?? 0) + (incomingCount.get(id) ?? 0);
    if (total >= minPassesForNode) nodeIds.add(id);
  }

  // Build nodes, sorted by pass count (descending) for deterministic output.
  const nodes: PassNetworkNode[] = [];
  for (const id of nodeIds) {
    const samples = positionSamples.get(id) ?? [];
    if (samples.length === 0) continue;
    const meanX = meanBy(samples, (sample) => sample.x);
    const meanY = meanBy(samples, (sample) => sample.y);
    const passCount = outgoingCount.get(id) ?? 0;
    const xT = xTForPlayer(id);
    const { label, labelFull } = labelFor(id);
    const node: PassNetworkNode = {
      id,
      label,
      labelFull,
      x: meanX,
      y: meanY,
      passCount,
    };
    if (xT != null) node.xT = xT;
    nodes.push(node);
  }
  nodes.sort((a, b) => b.passCount - a.passCount);

  // Resolve initial clashes. When two players on the same team share the
  // same derived label (e.g. David Raya + Declan Rice → both "DR"), walk
  // the node list in pass-count-descending order and promote subsequent
  // colliders to progressively-longer surname prefixes until unique. The
  // highest-pass-count player keeps the short label.
  const taken = new Set<string>();
  for (const node of nodes) {
    if (!taken.has(node.label)) {
      taken.add(node.label);
      continue;
    }
    const fullName = node.labelFull ?? node.label;
    const tokens = fullName
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    const surname = tokens[tokens.length - 1] ?? node.label;
    let resolved = false;
    for (let len = 2; len <= surname.length; len++) {
      const candidate = surname.slice(0, len);
      if (!taken.has(candidate)) {
        node.label = candidate;
        taken.add(candidate);
        resolved = true;
        break;
      }
    }
    if (!resolved) {
      // Exhausted every surname prefix — accept the clash silently.
      taken.add(node.label);
    }
  }

  // Build directional edges.
  const edges: PassNetworkEdge[] = [];
  for (const [source, bucket] of pairCounts) {
    if (!nodeIds.has(source)) continue;
    for (const [target, count] of bucket) {
      if (!nodeIds.has(target)) continue;
      if (count < minPassesForEdge) continue;
      const xT = xTForPair(source, target);
      const edge: PassNetworkEdge = {
        sourceId: source,
        targetId: target,
        passCount: count,
      };
      if (xT != null) edge.xT = xT;
      edges.push(edge);
    }
  }

  return {
    nodes,
    edges,
    warnings,
    window: [windowStart, windowEnd],
  };
}
