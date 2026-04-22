import type { MatchSummary } from "@withqwerty/campos-schema";

import {
  buildFallbackMatchId,
  normalizeText,
  toIsoString,
  toNullableInteger,
} from "../shared/match-summary.js";

export type SofascoreMatchStatus = {
  code?: number | null;
  description?: string | null;
  type?: string | null;
};

export type SofascoreMatchTeam = {
  id?: number | string | null;
  name?: string | null;
  shortName?: string | null;
};

export type SofascoreMatchScore = {
  current?: number | null;
  penalties?: number | null;
};

export type SofascoreMatchEvent = {
  id?: number | string | null;
  status?: SofascoreMatchStatus | null;
  startTimestamp?: number | null;
  homeTeam: SofascoreMatchTeam;
  awayTeam: SofascoreMatchTeam;
  homeScore?: SofascoreMatchScore | null;
  awayScore?: SofascoreMatchScore | null;
  tournament?: { name?: string | null } | null;
  season?: { name?: string | null; year?: string | number | null } | null;
  venue?: { name?: string | null } | null;
  roundInfo?: { round?: number | null } | null;
};

export const fromSofascore = {
  matchSummary(event: SofascoreMatchEvent): MatchSummary {
    const matchId =
      event.id != null
        ? String(event.id)
        : buildFallbackMatchId(
            event.homeTeam.name,
            event.awayTeam.name,
            event.startTimestamp,
          );
    const statusLabel = normalizeText(event.status?.description);

    return {
      matchId,
      ...(normalizeText(event.tournament?.name) != null
        ? { competitionLabel: normalizeText(event.tournament?.name) }
        : {}),
      ...(normalizeText(event.season?.name) != null
        ? { seasonLabel: normalizeText(event.season?.name) }
        : event.season?.year != null
          ? { seasonLabel: String(event.season.year) }
          : {}),
      ...(event.startTimestamp != null
        ? { kickoff: toIsoString(event.startTimestamp * 1000) }
        : {}),
      status: resolveStatus(event.status),
      ...(statusLabel != null ? { statusLabel } : {}),
      ...(normalizeText(event.venue?.name) != null
        ? { venue: normalizeText(event.venue?.name) }
        : {}),
      home: {
        ...(event.homeTeam.id != null ? { teamId: String(event.homeTeam.id) } : {}),
        teamLabel: requireTeamLabel(event.homeTeam, "home"),
        ...(toNullableInteger(event.homeScore?.current) != null
          ? { score: toNullableInteger(event.homeScore?.current) }
          : {}),
        ...(toNullableInteger(event.homeScore?.penalties) != null
          ? { penalties: toNullableInteger(event.homeScore?.penalties) }
          : {}),
      },
      away: {
        ...(event.awayTeam.id != null ? { teamId: String(event.awayTeam.id) } : {}),
        teamLabel: requireTeamLabel(event.awayTeam, "away"),
        ...(toNullableInteger(event.awayScore?.current) != null
          ? { score: toNullableInteger(event.awayScore?.current) }
          : {}),
        ...(toNullableInteger(event.awayScore?.penalties) != null
          ? { penalties: toNullableInteger(event.awayScore?.penalties) }
          : {}),
      },
      sourceMeta: {
        ...(event.status?.code != null ? { statusCode: event.status.code } : {}),
        ...(normalizeText(event.status?.type) != null
          ? { statusType: normalizeText(event.status?.type) }
          : {}),
        ...(toNullableInteger(event.roundInfo?.round) != null
          ? { round: toNullableInteger(event.roundInfo?.round) }
          : {}),
      },
    };
  },
};

function requireTeamLabel(team: SofascoreMatchTeam, side: "home" | "away"): string {
  const label = normalizeText(team.name);
  if (label == null) {
    throw new Error(`Sofascore ${side} team is missing a display name`);
  }
  return label;
}

// Sofascore status codes and `type` buckets are documented in the ScraperFC
// SOFASCORE_STATUSES table (github.com/oseymour/ScraperFC). `type` is the
// coarse bucket and takes precedence; codes refine it for halftime, extra
// time, and penalty-shootout states.
function resolveStatus(
  status: SofascoreMatchStatus | null | undefined,
): MatchSummary["status"] {
  const code = status?.code ?? null;
  const type = normalizeText(status?.type)?.toLowerCase() ?? null;

  if (type === "finished") {
    return "finished";
  }

  if (type === "inprogress") {
    if (code === 31 || code === 41 || code === 50) return "halftime";
    return "live";
  }

  if (type === "notstarted") return "scheduled";
  if (type === "postponed") return "postponed";
  if (type === "canceled") return "canceled";

  switch (code) {
    case 0:
      return "scheduled";
    case 6:
    case 7:
    case 8:
    case 9:
      return "live";
    case 31:
    case 41:
    case 50:
      return "halftime";
    case 60:
      return "postponed";
    case 70:
      return "canceled";
    case 90:
      return "abandoned";
    case 100:
    case 110:
    case 120:
    case 130:
    case 140:
      return "finished";
  }

  return "unknown";
}
