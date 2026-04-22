import type { MatchSummary } from "@withqwerty/campos-schema";

import {
  buildFallbackMatchId,
  normalizeText,
  parseScoreline,
  toIsoString,
  toNullableInteger,
  toNullableNumber,
  type ParsedScoreline,
} from "../shared/match-summary.js";

export type FbrefScheduleRow = {
  game_id?: string | null;
  game?: string | null;
  league?: string | null;
  season?: string | number | null;
  date?: string | Date | null;
  home_team: string;
  away_team: string;
  home_xg?: number | null;
  away_xg?: number | null;
  score?: string | null;
  attendance?: number | string | null;
  venue?: string | null;
  notes?: string | null;
};

export const fromFbref = {
  matchSummary(row: FbrefScheduleRow): MatchSummary {
    const homeTeam = requireTeamLabel(row.home_team, "home");
    const awayTeam = requireTeamLabel(row.away_team, "away");
    const parsedScore = parseScoreline(row.score);
    const notes = normalizeText(row.notes);
    const status = resolveStatus(parsedScore, notes);
    const matchId =
      normalizeText(row.game_id) ??
      buildFallbackMatchId(row.game, homeTeam, awayTeam, row.date);
    const shootoutWinner =
      parsedScore?.resolvedIn === "shootout" && parsedScore.shootout
        ? parsedScore.shootout.home > parsedScore.shootout.away
          ? "home"
          : "away"
        : null;
    const resolvedStatusLabel = buildFbrefStatusLabel(parsedScore, notes);
    const kickoff = toIsoString(row.date);
    const venue = normalizeText(row.venue);
    const attendance = toNullableInteger(row.attendance);
    const homeXg = toNullableNumber(row.home_xg);
    const awayXg = toNullableNumber(row.away_xg);
    const sourceMeta: Record<string, unknown> = {};
    if (notes != null) sourceMeta.notes = notes;
    if (parsedScore?.resolvedIn === "extra-time")
      sourceMeta.rawScore = normalizeText(row.score);

    return {
      matchId,
      ...(row.league != null ? { competitionLabel: row.league } : {}),
      ...(row.season != null ? { seasonLabel: String(row.season) } : {}),
      ...(kickoff != null ? { kickoff } : {}),
      status,
      ...(resolvedStatusLabel != null ? { statusLabel: resolvedStatusLabel } : {}),
      ...(parsedScore?.resolvedIn != null ? { resolvedIn: parsedScore.resolvedIn } : {}),
      ...(shootoutWinner != null ? { shootoutWinner } : {}),
      ...(venue != null ? { venue } : {}),
      ...(attendance != null ? { attendance } : {}),
      home: {
        teamLabel: homeTeam,
        ...(parsedScore != null ? { score: parsedScore.home } : {}),
        ...(parsedScore?.shootout != null
          ? { penalties: parsedScore.shootout.home }
          : {}),
        ...(homeXg != null ? { xg: homeXg } : {}),
      },
      away: {
        teamLabel: awayTeam,
        ...(parsedScore != null ? { score: parsedScore.away } : {}),
        ...(parsedScore?.shootout != null
          ? { penalties: parsedScore.shootout.away }
          : {}),
        ...(awayXg != null ? { xg: awayXg } : {}),
      },
      ...(Object.keys(sourceMeta).length > 0 ? { sourceMeta } : {}),
    };
  },
};

function requireTeamLabel(
  value: string | null | undefined,
  side: "home" | "away",
): string {
  const label = normalizeText(value);
  if (label == null) {
    throw new Error(`FBref ${side} team row is missing a team name`);
  }
  return label;
}

function buildFbrefStatusLabel(
  parsedScore: ParsedScoreline | null,
  notes: string | null,
): string | null {
  if (notes != null && !/^\s*(ft|final)\s*$/i.test(notes)) return notes;
  if (parsedScore == null) return null;
  if (parsedScore.resolvedIn === "shootout") return "AP";
  if (parsedScore.resolvedIn === "extra-time") return "AET";
  return "FT";
}

function resolveStatus(
  parsedScore: ParsedScoreline | null,
  notes: string | null,
): MatchSummary["status"] {
  const normalizedNotes = notes?.toLowerCase() ?? null;

  if (normalizedNotes?.includes("postpon")) return "postponed";
  if (normalizedNotes?.includes("cancel")) return "canceled";
  if (normalizedNotes?.includes("abandon")) return "abandoned";
  if (normalizedNotes?.includes("awarded") || normalizedNotes?.includes("forfeit")) {
    return "awarded";
  }
  if (parsedScore != null) return "finished";

  return "scheduled";
}
