import type { CSSProperties, ReactElement, ReactNode } from "react";

import type {
  FormationKey,
  FormationLabelStrategy,
  FormationOrientation,
  FormationCrop,
  FormationHalfSide,
  FormationPlayer,
} from "./compute/index.js";
import type {
  Theme as PitchTheme,
  PitchColors,
  PitchPreset,
} from "@withqwerty/campos-stadia";

import type {
  MarkerGlyphConfig,
  MarkerGlyphPreset,
  MarkerSlotName,
  SubstitutesBenchPlacement,
} from "./primitives/index.js";
import type { StyleValue } from "./styleValue.js";
import { FormationDual } from "./formation/FormationDual.js";
import { FormationSingle } from "./formation/FormationSingle.js";
import { FormationStaticSvg as FormationStaticSvgImpl } from "./formation/FormationStaticSvg.js";
import { FORMATION_MODE_ERROR } from "./formation/shared.js";

export type FormationMarkerComposition = {
  glyph?: MarkerGlyphConfig;
  slots?: (ctx: MarkerSlotContext) => Partial<Record<MarkerSlotName, MarkerSlotContent>>;
};

export type FormationMarkersStyle = {
  glyphKind?: StyleValue<MarkerGlyphPreset, MarkerSlotContext>;
  fill?: StyleValue<string, MarkerSlotContext>;
  stroke?: StyleValue<string, MarkerSlotContext>;
  strokeWidth?: StyleValue<number, MarkerSlotContext>;
};

export type FormationMarkerLabelsStyle = {
  nameFormat?: (player: FormationPlayer) => string | null;
  background?: StyleValue<string, MarkerSlotContext>;
  color?: StyleValue<string, MarkerSlotContext>;
};

export type FormationMarkerBadgesStyle = {
  prefix?: (ctx: MarkerSlotContext) => ReactNode;
};

export type FormationMarkerPreset = {
  markers?: FormationMarkersStyle;
  markerLabels?: FormationMarkerLabelsStyle;
  markerBadges?: FormationMarkerBadgesStyle;
  markerComposition?: FormationMarkerComposition;
};

export type MarkerSlotContext = {
  player: FormationPlayer;
  r: number;
  teamColor: string;
};

export type MarkerSlotContent = ReactNode | ReactNode[] | null | undefined | false;

export type FormationLegendPlacement =
  | "none"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right";

export type FormationTeamSpec = {
  label?: string;
  formation: FormationKey;
  players?: FormationPlayer[];
  color?: string;
  substitutes?: FormationPlayer[];
};

type FormationCommonProps = {
  labelStrategy?: FormationLabelStrategy;
  showLabels?: boolean;
  showNames?: boolean;
  className?: string;
  style?: CSSProperties;
  pitchPreset?: PitchPreset;
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  markers?: FormationMarkersStyle;
  markerLabels?: FormationMarkerLabelsStyle;
  markerBadges?: FormationMarkerBadgesStyle;
  markerComposition?: FormationMarkerComposition;
};

export type FormationSingleProps = FormationCommonProps & {
  formation: FormationKey;
  players?: FormationPlayer[];
  teamColor?: string;
  teamLabel?: string;
  attackingDirection?: FormationOrientation;
  crop?: FormationCrop;
  side?: FormationHalfSide;
  flip?: boolean;
  substitutes?: FormationPlayer[];
  substitutesPlacement?: SubstitutesBenchPlacement;
  substitutesLabel?: string;
  home?: never;
  away?: never;
};

export type FormationDualProps = FormationCommonProps & {
  home: FormationTeamSpec;
  away: FormationTeamSpec;
  attackingDirection?: FormationOrientation;
  legendPlacement?: FormationLegendPlacement;
  formation?: never;
  players?: never;
  teamColor?: never;
  teamLabel?: never;
  crop?: never;
  side?: never;
  flip?: never;
};

export type FormationProps = FormationSingleProps | FormationDualProps;

function isDualProps(props: FormationProps): props is FormationDualProps {
  const bag = props as unknown as {
    home?: FormationTeamSpec | null;
    away?: FormationTeamSpec | null;
  };
  return bag.home != null && bag.away != null;
}

function isSingleProps(props: FormationProps): props is FormationSingleProps {
  const bag = props as unknown as { formation?: FormationKey | null };
  return bag.formation != null;
}

export function Formation(props: FormationProps): ReactElement {
  if (isDualProps(props)) {
    return <FormationDual {...props} />;
  }
  if (isSingleProps(props)) {
    return <FormationSingle {...props} />;
  }
  throw new Error(FORMATION_MODE_ERROR);
}

export function FormationStaticSvg(props: FormationProps): ReactElement {
  return <FormationStaticSvgImpl {...props} />;
}
