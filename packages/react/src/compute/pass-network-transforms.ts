import type { PassEvent } from "@withqwerty/campos-schema";
import type { PassNetworkEdge, PassNetworkNode } from "./pass-network.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CompressSide = "left" | "right";

export type CompressPassNetworkOptions = {
  /** Which half of the pitch the network should be compressed into. */
  side: CompressSide;
  /**
   * Optional solid color applied as a per-node and per-edge override so a
   * combined H2H network can be rendered through a single chart instance
   * with two distinct team colors.
   */
  color?: string;
};

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Derive a short label from a player name so it reliably fits inside a
 * node circle at typical network sizes.
 *
 * - single token → keep the token as-is ("Raya" → "Raya")
 * - two tokens   → first letter of first + first letter of last
 *   ("Martin Ødegaard" → "MØ")
 * - three+ tokens → first letter of first token + first letter of last
 *   token ("Luis Alberto Suárez" → "LS")
 * - empty / whitespace → "?"
 */
export function deriveInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0] as string;
  const first = tokens[0] as string;
  const last = tokens[tokens.length - 1] as string;
  return `${first[0] ?? ""}${last[0] ?? ""}`;
}

/**
 * Remap a pass network so every node sits inside the chosen half of the
 * pitch while preserving each player's relative x-position within that
 * half. The y-axis is untouched. Optionally tag every node and edge with
 * a team-wide color override so a single chart instance can render an H2H
 * view by combining two compressed networks.
 *
 * - `side: "left"`: x → x * 0.5, network occupies x ∈ [0, 50].
 * - `side: "right"`: x → 100 - x * 0.5, mirrored so the team still
 *   "attacks" toward midfield (x = 50) from the right edge.
 */
export function compressPassNetwork(
  network: { nodes: readonly PassNetworkNode[]; edges: readonly PassNetworkEdge[] },
  options: CompressPassNetworkOptions,
): { nodes: PassNetworkNode[]; edges: PassNetworkEdge[] } {
  const { side, color } = options;
  const transformX = (x: number): number => (side === "left" ? x * 0.5 : 100 - x * 0.5);

  const nodes = network.nodes.map((n) => {
    const next: PassNetworkNode = { ...n, x: transformX(n.x) };
    if (color != null) next.color = color;
    return next;
  });
  const edges = network.edges.map((e) => {
    const next: PassNetworkEdge = { ...e };
    if (color != null) next.color = color;
    return next;
  });
  return { nodes, edges };
}

export type InferRecipientsOptions = {
  /**
   * Maximum time gap (in seconds) between a pass and the next same-team pass
   * for that pass's recipient to be inferred from the next passer's name.
   * Longer gaps likely indicate possession turnovers and are skipped. Default: 15.
   */
  maxGapSeconds?: number;
};

/**
 * Fill in missing `recipient` values on a pass event stream using the next
 * same-team pass's passer as the inferred recipient. This matches the
 * "next-on-ball touch" heuristic used by most open-source pass-network
 * implementations when the source data lacks an explicit recipient field
 * (e.g. WhoScored JSON without `INVOLVED_PLAYER` qualifier).
 *
 * Rules:
 * - Passes with a non-null recipient are left untouched.
 * - For each pass with `recipient == null`, walk forward in time looking
 *   for the next pass by the same team. If found within `maxGapSeconds`,
 *   use its `playerName` as the recipient. Otherwise leave the recipient
 *   as null — the aggregate helper will drop the pass.
 * - Input order is NOT assumed to be time-sorted; the function sorts by
 *   (minute, addedMinute, second) internally.
 * - Input is treated as immutable; a new array with cloned rows is returned.
 */
export function inferRecipientsFromNextPass(
  passes: readonly PassEvent[],
  options: InferRecipientsOptions = {},
): PassEvent[] {
  const maxGapSeconds = options.maxGapSeconds ?? 15;
  // Sort a copy by (minute, addedMinute ?? 0, second) ascending.
  const sorted = passes.slice().sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    const aAdded = a.addedMinute ?? 0;
    const bAdded = b.addedMinute ?? 0;
    if (aAdded !== bAdded) return aAdded - bAdded;
    return a.second - b.second;
  });
  // Convert to an "absolute seconds" number for gap math.
  const absSeconds = (p: PassEvent): number =>
    (p.minute + (p.addedMinute ?? 0)) * 60 + p.second;

  const result: PassEvent[] = sorted.map((p) => ({ ...p }));
  for (let i = 0; i < result.length; i++) {
    const p = result[i] as PassEvent;
    if (p.recipient != null && p.recipient.length > 0) continue;
    const pTime = absSeconds(p);
    // Scan forward for the next same-team pass with a non-null playerName.
    for (let j = i + 1; j < result.length; j++) {
      const next = result[j] as PassEvent;
      if (next.teamId !== p.teamId) continue;
      if (next.playerName == null || next.playerName.length === 0) continue;
      if (next.playerName === p.playerName) continue; // same player, skip
      const gap = absSeconds(next) - pTime;
      if (gap > maxGapSeconds) break;
      p.recipient = next.playerName;
      break;
    }
  }
  return result;
}

/**
 * Shallow-merge several pass networks into one. Node ids must be globally
 * unique across all inputs — callers should tag ids per team (e.g.
 * "home:MØ") before calling. The returned arrays keep input order.
 */
export function combinePassNetworks(
  ...networks: ReadonlyArray<{
    nodes: readonly PassNetworkNode[];
    edges: readonly PassNetworkEdge[];
  }>
): { nodes: PassNetworkNode[]; edges: PassNetworkEdge[] } {
  const nodes: PassNetworkNode[] = [];
  const edges: PassNetworkEdge[] = [];
  for (const network of networks) {
    nodes.push(...network.nodes);
    edges.push(...network.edges);
  }
  return { nodes, edges };
}
