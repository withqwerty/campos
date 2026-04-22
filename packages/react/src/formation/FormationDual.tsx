import type { CSSProperties, ReactElement } from "react";

import {
  isVerticalFormation,
  layoutDualTeam,
  type FormationTeamData,
} from "../compute/index.js";
import { PITCH, Pitch } from "@withqwerty/campos-stadia";

import type { FormationDualProps } from "../Formation.js";
import { SubstitutesBench } from "../primitives/index.js";

import { FormationMarker } from "./FormationMarker.js";
import { DualTeamLegend } from "./formationLegend.js";
import {
  DEFAULT_AWAY_COLOR,
  DEFAULT_HOME_COLOR,
  SCALE_DUAL,
  buildDualAriaLabel,
  formationRootStyle,
} from "./shared.js";

export function FormationDual(props: FormationDualProps): ReactElement {
  const {
    home,
    away,
    attackingDirection = "up",
    legendPlacement = "bottom",
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
  } = props;

  const homeColor = home.color ?? DEFAULT_HOME_COLOR;
  const awayColor = away.color ?? DEFAULT_AWAY_COLOR;

  const homeTeamData: FormationTeamData = {
    formation: home.formation,
    players: home.players ?? [],
    ...(home.label != null ? { teamLabel: home.label } : {}),
    teamColor: homeColor,
  };
  const awayTeamData: FormationTeamData = {
    formation: away.formation,
    players: away.players ?? [],
    ...(away.label != null ? { teamLabel: away.label } : {}),
    teamColor: awayColor,
  };

  const layout = layoutDualTeam(homeTeamData, awayTeamData);
  const ariaLabel = buildDualAriaLabel({ home, away });
  const hasAnyLabel =
    (home.label != null && home.label.length > 0) ||
    (away.label != null && away.label.length > 0);
  const showLegend = legendPlacement !== "none" && hasAnyLabel;
  const pitchSvgWidth = isVerticalFormation(attackingDirection)
    ? PITCH.width
    : PITCH.length;
  const pitchSvgHeight = isVerticalFormation(attackingDirection)
    ? PITCH.length
    : PITCH.width;

  const pitch = (
    <Pitch
      crop="full"
      attackingDirection={attackingDirection}
      role="img"
      ariaLabel={ariaLabel}
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

  const legend = showLegend ? (
    <DualTeamLegend
      home={home}
      away={away}
      homeColor={homeColor}
      awayColor={awayColor}
      placement={legendPlacement}
    />
  ) : null;

  const homeBench =
    home.substitutes && home.substitutes.length > 0 ? (
      <SubstitutesBench
        players={home.substitutes}
        placement={isVerticalFormation(attackingDirection) ? "bottom" : "right"}
        teamColor={homeColor}
        label={home.label ? `${home.label} subs` : "Home subs"}
      />
    ) : null;
  const awayBench =
    away.substitutes && away.substitutes.length > 0 ? (
      <SubstitutesBench
        players={away.substitutes}
        placement={isVerticalFormation(attackingDirection) ? "top" : "left"}
        teamColor={awayColor}
        label={away.label ? `${away.label} subs` : "Away subs"}
      />
    ) : null;

  const hasBenches = homeBench != null || awayBench != null;

  const wrapWithBenches = (content: ReactElement): ReactElement => {
    if (!hasBenches) return content;
    const axis = isVerticalFormation(attackingDirection) ? "column" : "row";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: axis,
          gap: 12,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        {awayBench}
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>{content}</div>
        {homeBench}
      </div>
    );
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: legendPlacement === "top" ? "column-reverse" : "column",
    gap: legendPlacement === "top" || legendPlacement === "bottom" ? 8 : 0,
    ...formationRootStyle({ attackingDirection, dual: true, style }),
  };

  if (
    legendPlacement === "top-left" ||
    legendPlacement === "top-right" ||
    legendPlacement === "none"
  ) {
    return (
      <div
        className={className}
        style={{
          position: "relative",
          ...formationRootStyle({ attackingDirection, dual: true, style }),
        }}
      >
        {wrapWithBenches(pitch)}
        {legend}
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      {wrapWithBenches(pitch)}
      {legend}
    </div>
  );
}
