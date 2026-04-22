import type { CSSProperties } from "react";

import type {
  FormationCrop,
  FormationHalfSide,
  FormationKey,
  FormationOrientation,
} from "../compute/index.js";

import type { FormationTeamSpec } from "../Formation.js";

export const FORMATION_MODE_ERROR =
  "Formation requires either `formation` (single-team mode) or both `home` and `away` (dual-team mode)";

export const DEFAULT_TEAM_COLOR = "#d33";
export const DEFAULT_HOME_COLOR = "#e50027";
export const DEFAULT_AWAY_COLOR = "#2563eb";
export const STROKE_COLOR = "#1a202c";

const BASE_MARKER_RADIUS = 3.2;
const BASE_LABEL_FONT_SIZE = 2.8;
const BASE_NAME_FONT_SIZE = 2.2;

export type MarkerScale = {
  radius: number;
  labelFontSize: number;
  nameFontSize: number;
  labelStrokeWidth: number;
  namePillRx: number;
};

function makeScale(factor: number): MarkerScale {
  return {
    radius: BASE_MARKER_RADIUS * factor,
    labelFontSize: BASE_LABEL_FONT_SIZE * factor,
    nameFontSize: BASE_NAME_FONT_SIZE * factor,
    labelStrokeWidth: 0.18 * factor,
    namePillRx: 0.6 * factor,
  };
}

export const SCALE_FULL = makeScale(1);
export const SCALE_HALF = makeScale(0.78);
export const SCALE_DUAL = makeScale(0.62);

export function formationRootStyle({
  attackingDirection,
  crop,
  dual,
  style,
}: {
  attackingDirection: FormationOrientation;
  crop?: FormationCrop;
  dual: boolean;
  style: CSSProperties | undefined;
}): CSSProperties {
  const isHorizontal = attackingDirection === "left" || attackingDirection === "right";
  const baseMaxWidth = isHorizontal
    ? dual
      ? 760
      : 720
    : dual
      ? 520
      : crop === "half"
        ? 360
        : 440;

  return {
    width: "100%",
    maxWidth: baseMaxWidth,
    ...(style ?? {}),
  };
}

export function resolveSingleFormationFlip(
  crop: FormationCrop,
  side: FormationHalfSide,
  flip: boolean | undefined,
): boolean {
  if (flip !== undefined) return flip;
  return crop === "half" && side === "attack";
}

export function buildSingleAriaLabel(input: {
  formation: FormationKey;
  teamLabel?: string | undefined;
  playerCount: number;
}): string {
  const { formation, teamLabel, playerCount } = input;
  const base =
    teamLabel != null && teamLabel.length > 0
      ? `${teamLabel} ${formation} formation`
      : `${formation} formation`;
  return playerCount > 0 ? `${base} lineup with ${playerCount} players` : base;
}

export function buildDualAriaLabel(input: {
  home: FormationTeamSpec;
  away: FormationTeamSpec;
}): string {
  const { home, away } = input;
  const homeName = home.label != null && home.label.length > 0 ? home.label : "Home";
  const awayName = away.label != null && away.label.length > 0 ? away.label : "Away";
  return `${homeName} ${home.formation} vs ${awayName} ${away.formation} lineup`;
}

export function truncateName(name: string): string {
  const MAX_LENGTH = 12;
  if (name.length <= MAX_LENGTH) return name;
  return name.slice(0, MAX_LENGTH - 1) + "…";
}
