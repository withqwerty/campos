import type { ReactElement } from "react";

import {
  isVerticalFormation,
  layoutDualTeam,
  layoutSingleTeam,
} from "../compute/index.js";
import { computeViewBox, PITCH, Pitch } from "@withqwerty/campos-stadia";

import type {
  FormationDualProps,
  FormationProps,
  FormationSingleProps,
} from "../Formation.js";

import { FormationMarker } from "./FormationMarker.js";
import {
  DEFAULT_AWAY_COLOR,
  DEFAULT_HOME_COLOR,
  DEFAULT_TEAM_COLOR,
  FORMATION_MODE_ERROR,
  SCALE_DUAL,
  SCALE_FULL,
  SCALE_HALF,
  buildDualAriaLabel,
  buildSingleAriaLabel,
  resolveSingleFormationFlip,
} from "./shared.js";

function isDualProps(props: FormationProps): props is FormationDualProps {
  const bag = props as unknown as { home?: unknown; away?: unknown };
  return bag.home != null && bag.away != null;
}

function isSingleProps(props: FormationProps): props is FormationSingleProps {
  const bag = props as unknown as { formation?: unknown };
  return bag.formation != null;
}

export function FormationStaticSvg(props: FormationProps): ReactElement {
  if (isDualProps(props)) {
    const {
      home,
      away,
      attackingDirection = "up",
      labelStrategy = "auto",
      showLabels = true,
      showNames = true,
      pitchPreset,
      pitchTheme,
      pitchColors,
      markers,
      markerLabels,
      markerBadges,
      markerComposition,
    } = props;
    const homeColor = home.color ?? DEFAULT_HOME_COLOR;
    const awayColor = away.color ?? DEFAULT_AWAY_COLOR;
    const pitchSvgWidth = isVerticalFormation(attackingDirection)
      ? PITCH.width
      : PITCH.length;
    const pitchSvgHeight = isVerticalFormation(attackingDirection)
      ? PITCH.length
      : PITCH.width;
    const layout = layoutDualTeam(
      {
        formation: home.formation,
        players: home.players ?? [],
        ...(home.label != null ? { teamLabel: home.label } : {}),
        teamColor: homeColor,
      },
      {
        formation: away.formation,
        players: away.players ?? [],
        ...(away.label != null ? { teamLabel: away.label } : {}),
        teamColor: awayColor,
      },
    );

    return (
      <Pitch
        crop="full"
        attackingDirection={attackingDirection}
        interactive={false}
        role="img"
        ariaLabel={buildDualAriaLabel({ home, away })}
        {...(pitchPreset != null ? { preset: pitchPreset } : {})}
        {...(pitchTheme != null ? { theme: pitchTheme } : {})}
        {...(pitchColors != null ? { colors: pitchColors } : {})}
      >
        {({ project }) => (
          <>
            <g data-team="home">
              {layout.home.slots.map((slot) => (
                <FormationMarker
                  key={`home-${slot.slot}`}
                  slot={slot}
                  project={project}
                  teamColor={homeColor}
                  labelStrategy={labelStrategy}
                  showLabels={showLabels}
                  showNames={showNames}
                  scale={SCALE_DUAL}
                  {...(markers !== undefined ? { markers } : {})}
                  {...(markerLabels !== undefined ? { markerLabels } : {})}
                  {...(markerBadges !== undefined ? { markerBadges } : {})}
                  {...(markerComposition !== undefined ? { markerComposition } : {})}
                  pitchSvgWidth={pitchSvgWidth}
                  pitchSvgHeight={pitchSvgHeight}
                />
              ))}
            </g>
            <g data-team="away">
              {layout.away.slots.map((slot) => (
                <FormationMarker
                  key={`away-${slot.slot}`}
                  slot={slot}
                  project={project}
                  teamColor={awayColor}
                  labelStrategy={labelStrategy}
                  showLabels={showLabels}
                  showNames={showNames}
                  scale={SCALE_DUAL}
                  {...(markers !== undefined ? { markers } : {})}
                  {...(markerLabels !== undefined ? { markerLabels } : {})}
                  {...(markerBadges !== undefined ? { markerBadges } : {})}
                  {...(markerComposition !== undefined ? { markerComposition } : {})}
                  pitchSvgWidth={pitchSvgWidth}
                  pitchSvgHeight={pitchSvgHeight}
                />
              ))}
            </g>
          </>
        )}
      </Pitch>
    );
  }

  if (!isSingleProps(props)) {
    throw new Error(FORMATION_MODE_ERROR);
  }

  const {
    formation,
    players = [],
    teamColor = DEFAULT_TEAM_COLOR,
    teamLabel,
    attackingDirection = "up",
    crop = "full",
    side = "attack",
    flip,
    labelStrategy = "auto",
    showLabels = true,
    showNames = true,
    pitchPreset,
    pitchTheme,
    pitchColors,
    markers,
    markerLabels,
    markerBadges,
    markerComposition,
  } = props;
  const resolvedFlip = resolveSingleFormationFlip(crop, side, flip);
  const pitchViewBox = computeViewBox(crop, attackingDirection, side);
  const layout = layoutSingleTeam(
    {
      formation,
      players,
      teamColor,
      ...(teamLabel != null ? { teamLabel } : {}),
    },
    { attackingDirection, crop, side, flip: resolvedFlip },
  );
  const scale = crop === "half" ? SCALE_HALF : SCALE_FULL;
  const pitchSvgWidth = pitchViewBox.width;
  const pitchSvgHeight = pitchViewBox.height;
  const pitchSvgMinX = pitchViewBox.minX;
  const pitchSvgMinY = pitchViewBox.minY;

  return (
    <Pitch
      crop={crop}
      attackingDirection={attackingDirection}
      side={side}
      interactive={false}
      role="img"
      ariaLabel={buildSingleAriaLabel({
        formation,
        teamLabel,
        playerCount: players.length,
      })}
      {...(pitchPreset != null ? { preset: pitchPreset } : {})}
      {...(pitchTheme != null ? { theme: pitchTheme } : {})}
      {...(pitchColors != null ? { colors: pitchColors } : {})}
    >
      {({ project }) => (
        <>
          {layout.slots.map((slot) => (
            <FormationMarker
              key={slot.slot}
              slot={slot}
              project={project}
              teamColor={teamColor}
              labelStrategy={labelStrategy}
              showLabels={showLabels}
              showNames={showNames}
              scale={scale}
              {...(markers !== undefined ? { markers } : {})}
              {...(markerLabels !== undefined ? { markerLabels } : {})}
              {...(markerBadges !== undefined ? { markerBadges } : {})}
              {...(markerComposition !== undefined ? { markerComposition } : {})}
              pitchSvgWidth={pitchSvgWidth}
              pitchSvgHeight={pitchSvgHeight}
              pitchSvgMinX={pitchSvgMinX}
              pitchSvgMinY={pitchSvgMinY}
            />
          ))}
        </>
      )}
    </Pitch>
  );
}
