import type { MatchSummary, ShotEvent } from "@withqwerty/campos-schema";
import { clampToCamposRange } from "@withqwerty/campos-schema";

import {
  buildFallbackMatchId,
  normalizeText,
  toIsoString,
  toNullableInteger,
  toNullableNumber,
} from "../shared/match-summary.js";

const PROVIDER = "understat";

export type UnderstatScheduleRow = {
  game_id?: number | string | null;
  league?: string | null;
  season?: string | number | null;
  date?: string | Date | null;
  home_team_id?: number | string | null;
  away_team_id?: number | string | null;
  home_team: string;
  away_team: string;
  home_goals?: number | null;
  away_goals?: number | null;
  home_xg?: number | null;
  away_xg?: number | null;
  is_result?: boolean | null;
  has_data?: boolean | null;
  url?: string | null;
};

export type UnderstatShotRow = {
  game_id?: number | string | null;
  shot_id?: number | string | null;
  team_id?: number | string | null;
  team?: string | null;
  player_id?: number | string | null;
  player?: string | null;
  assist_player_id?: number | string | null;
  assist_player?: string | null;
  xg?: number | null;
  location_x?: number | null;
  location_y?: number | null;
  minute?: number | null;
  body_part?: string | null;
  situation?: string | null;
  result?: string | null;
};

export const fromUnderstat = {
  matchSummary(row: UnderstatScheduleRow): MatchSummary {
    const homeTeam = requireUnderstatTeamLabel(row.home_team, "home");
    const awayTeam = requireUnderstatTeamLabel(row.away_team, "away");
    const matchId =
      row.game_id != null
        ? String(row.game_id)
        : buildFallbackMatchId(homeTeam, awayTeam, row.date);
    const sourceMeta: Record<string, unknown> = {};
    if (row.has_data != null) sourceMeta.hasData = row.has_data;
    const urlText = normalizeText(row.url);
    if (urlText != null) sourceMeta.url = urlText;

    return {
      matchId,
      ...(row.league != null ? { competitionLabel: row.league } : {}),
      ...(row.season != null ? { seasonLabel: String(row.season) } : {}),
      ...(toIsoString(row.date) != null ? { kickoff: toIsoString(row.date) } : {}),
      status: row.is_result === true ? "finished" : "scheduled",
      ...(row.is_result === true ? { statusLabel: "FT" } : {}),
      home: {
        ...(row.home_team_id != null ? { teamId: String(row.home_team_id) } : {}),
        teamLabel: homeTeam,
        ...(row.home_goals != null ? { score: row.home_goals } : {}),
        ...(row.home_xg != null ? { xg: row.home_xg } : {}),
      },
      away: {
        ...(row.away_team_id != null ? { teamId: String(row.away_team_id) } : {}),
        teamLabel: awayTeam,
        ...(row.away_goals != null ? { score: row.away_goals } : {}),
        ...(row.away_xg != null ? { xg: row.away_xg } : {}),
      },
      ...(Object.keys(sourceMeta).length > 0 ? { sourceMeta } : {}),
    };
  },

  shots(rows: readonly UnderstatShotRow[]): ShotEvent[] {
    return rows.map(mapUnderstatShot).filter((shot): shot is ShotEvent => shot != null);
  },
};

function requireUnderstatTeamLabel(
  value: string | null | undefined,
  side: "home" | "away",
): string {
  const label = normalizeText(value);
  if (label == null) {
    throw new Error(`Understat ${side} team row is missing a team name`);
  }
  return label;
}

function mapUnderstatShot(row: UnderstatShotRow): ShotEvent | null {
  const rawX = toNullableNumber(row.location_x);
  const rawY = toNullableNumber(row.location_y);
  const minute = toNullableInteger(row.minute) ?? 0;
  const result = normalizeText(row.result);
  const isOwnGoal = result === "Own Goal";

  if (rawX == null || rawY == null || isOwnGoal) {
    return null;
  }

  const providerEventIdResolved =
    row.shot_id != null
      ? String(row.shot_id)
      : buildFallbackMatchId(row.player_id, minute);
  const matchId =
    row.game_id != null
      ? String(row.game_id)
      : buildFallbackMatchId(
          normalizeText(row.team) ?? row.team_id ?? row.player,
          normalizeText(row.player) ?? row.player_id,
          minute,
        );
  const playerId = row.player_id != null ? String(row.player_id) : null;
  const playerName = normalizeText(row.player);
  const teamId =
    row.team_id != null
      ? String(row.team_id)
      : (normalizeText(row.team) ?? "unknown-team");
  const context = normalizeContext(row.situation);
  const isPenalty = context === "penalty";

  return {
    kind: "shot",
    id: `${PROVIDER}:${matchId}:${providerEventIdResolved}`,
    matchId,
    teamId,
    playerId,
    playerName,
    minute,
    addedMinute: null,
    second: 0,
    period: inferPeriodFromMinute(minute),
    x: clampToCamposRange(rawX * 100),
    // Understat Y=0 is the top touchline (TV perspective); Campos canonical
    // y=0 is the attacker's right (physical bottom).
    y: clampToCamposRange(100 - rawY * 100),
    xg: toNullableNumber(row.xg),
    outcome: normalizeOutcome(result),
    bodyPart: normalizeBodyPart(row.body_part),
    isOwnGoal: false,
    isPenalty,
    context,
    provider: PROVIDER,
    providerEventId: providerEventIdResolved,
    sourceMeta: {
      ...(row.assist_player_id != null
        ? { assistPlayerId: String(row.assist_player_id) }
        : {}),
      ...(normalizeText(row.assist_player) != null
        ? { assistPlayer: normalizeText(row.assist_player) }
        : {}),
      ...(result != null ? { rawResult: result } : {}),
      ...(normalizeText(row.situation) != null
        ? { rawSituation: normalizeText(row.situation) }
        : {}),
    },
  };
}

function inferPeriodFromMinute(minute: number): 1 | 2 | 3 | 4 {
  if (minute < 45) return 1;
  if (minute < 90) return 2;
  if (minute < 105) return 3;
  return 4;
}

function normalizeOutcome(result: string | null): ShotEvent["outcome"] {
  switch (result) {
    case "Goal":
      return "goal";
    case "Blocked Shot":
      return "blocked";
    case "Saved Shot":
      return "saved";
    case "Missed Shot":
      return "off-target";
    case "Shot On Post":
      return "hit-woodwork";
    default:
      return "other";
  }
}

function normalizeBodyPart(bodyPart: string | null | undefined): ShotEvent["bodyPart"] {
  const normalized = normalizeText(bodyPart)?.toLowerCase();

  switch (normalized) {
    case "left foot":
    case "left-foot":
      return "left-foot";
    case "right foot":
    case "right-foot":
      return "right-foot";
    case "head":
      return "head";
    case "other":
    case "other body parts":
      return "other";
    default:
      return null;
  }
}

function normalizeContext(situation: string | null | undefined): ShotEvent["context"] {
  const normalized = normalizeText(situation)?.toLowerCase();

  switch (normalized) {
    case "open play":
      return "regular-play";
    case "from corner":
      return "from-corner";
    case "set piece":
      return "set-piece";
    case "direct freekick":
    case "direct free kick":
      return "direct-free-kick";
    case "penalty":
      return "penalty";
    default:
      return "other";
  }
}
