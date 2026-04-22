import type { CSSProperties, ReactElement } from "react";

import { isVerticalFormation, layoutSingleTeam } from "../compute/index.js";
import { computeViewBox, Pitch } from "@withqwerty/campos-stadia";

import type { FormationSingleProps } from "../Formation.js";
import { SubstitutesBench, type SubstitutesBenchPlacement } from "../primitives/index.js";

import { FormationMarker } from "./FormationMarker.js";
import {
  DEFAULT_TEAM_COLOR,
  SCALE_FULL,
  SCALE_HALF,
  buildSingleAriaLabel,
  formationRootStyle,
  resolveSingleFormationFlip,
} from "./shared.js";

export function FormationSingle(props: FormationSingleProps): ReactElement {
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
    className,
    style,
    pitchTheme,
    pitchColors,
    markers,
    markerLabels,
    markerBadges,
    markerComposition,
    substitutes,
    substitutesPlacement,
    substitutesLabel,
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

  const ariaLabel = buildSingleAriaLabel({
    formation,
    teamLabel,
    playerCount: players.length,
  });
  const scale = crop === "half" ? SCALE_HALF : SCALE_FULL;
  const pitchSvgWidth = pitchViewBox.width;
  const pitchSvgHeight = pitchViewBox.height;
  const pitchSvgMinX = pitchViewBox.minX;
  const pitchSvgMinY = pitchViewBox.minY;

  const resolvedBenchPlacement: SubstitutesBenchPlacement =
    substitutesPlacement ??
    (isVerticalFormation(attackingDirection) ? "right" : "bottom");
  const showBench = substitutes != null && substitutes.length > 0;

  const pitchEl = (
    <Pitch
      crop={crop}
      attackingDirection={attackingDirection}
      side={side}
      role="img"
      ariaLabel={ariaLabel}
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

  if (!showBench) {
    return (
      <div
        className={className}
        style={{
          position: "relative",
          ...formationRootStyle({ attackingDirection, crop, dual: false, style }),
        }}
      >
        {pitchEl}
      </div>
    );
  }

  const benchEl = (
    <SubstitutesBench
      players={substitutes}
      placement={resolvedBenchPlacement}
      teamColor={teamColor}
      {...(substitutesLabel !== undefined ? { label: substitutesLabel } : {})}
    />
  );

  const isVerticalAxis =
    resolvedBenchPlacement === "left" || resolvedBenchPlacement === "right";
  const benchFirst =
    resolvedBenchPlacement === "left" || resolvedBenchPlacement === "top";
  const containerStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: isVerticalAxis
      ? benchFirst
        ? "row-reverse"
        : "row"
      : benchFirst
        ? "column-reverse"
        : "column",
    gap: 12,
    alignItems: isVerticalAxis ? "flex-start" : "stretch",
    ...formationRootStyle({ attackingDirection, crop, dual: false, style }),
  };

  return (
    <div className={className} style={containerStyle}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>{pitchEl}</div>
      {benchEl}
    </div>
  );
}
