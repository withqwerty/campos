import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { FormationLegendPlacement, FormationTeamSpec } from "../Formation.js";

import { STROKE_COLOR } from "./shared.js";

type DualTeamLegendProps = {
  home: FormationTeamSpec;
  away: FormationTeamSpec;
  homeColor: string;
  awayColor: string;
  placement: FormationLegendPlacement;
};

export function DualTeamLegend(props: DualTeamLegendProps): ReactElement | null {
  const { home, away, homeColor, awayColor, placement } = props;
  if (placement === "none") return null;

  const homeLabel = home.label;
  const awayLabel = away.label;

  const chip = (label: string, color: string, side: "home" | "away"): ReactNode => (
    <span
      data-testid="formation-legend-item"
      data-team={side}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
        color: STROKE_COLOR,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          border: `1px solid ${STROKE_COLOR}`,
        }}
      />
      <span>{label}</span>
    </span>
  );

  const items: ReactNode[] = [];
  if (homeLabel != null && homeLabel.length > 0) {
    items.push(
      <div key="home" style={{ minWidth: 0 }}>
        {chip(homeLabel, homeColor, "home")}
      </div>,
    );
  }
  if (awayLabel != null && awayLabel.length > 0) {
    items.push(
      <div key="away" style={{ minWidth: 0 }}>
        {chip(awayLabel, awayColor, "away")}
      </div>,
    );
  }

  if (placement === "top" || placement === "bottom") {
    return (
      <div
        data-testid="formation-legend"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 8px",
          gap: 16,
        }}
      >
        {items}
      </div>
    );
  }

  const cornerStyle: CSSProperties = {
    position: "absolute",
    top: 8,
    ...(placement === "top-left" ? { left: 8 } : { right: 8 }),
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 8,
    background: "rgba(255, 255, 255, 0.92)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
    pointerEvents: "none",
  };

  return (
    <div data-testid="formation-legend" style={cornerStyle}>
      {items}
    </div>
  );
}
