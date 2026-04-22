import {
  computePitchMarkings,
  type PitchMarking,
  type PitchCrop,
  type PitchOrientation,
  type PitchSide,
} from "../geometry/pitch.js";
import { GrassPatternDefs, type GrassPattern } from "./grass.js";

type Props = {
  crop: PitchCrop;
  orientation: PitchOrientation;
  side: PitchSide;
  colors: { fill: string; lines: string };
  grass?: GrassPattern | undefined;
  /** Pre-computed markings — skips internal computePitchMarkings call when provided. */
  precomputedMarkings?: PitchMarking[];
};

const LINE_WIDTH = 0.3;
const GOAL_LINE_WIDTH = 0.6;

function renderMarking(marking: PitchMarking, stroke: string) {
  const sw = marking.thick ? GOAL_LINE_WIDTH : LINE_WIDTH;

  switch (marking.type) {
    case "rect":
      return (
        <rect
          key={marking.id}
          x={marking.x}
          y={marking.y}
          width={marking.width}
          height={marking.height}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
        />
      );
    case "line":
      return (
        <line
          key={marking.id}
          x1={marking.x}
          y1={marking.y}
          x2={marking.x2}
          y2={marking.y2}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "circle":
      return (
        <circle
          key={marking.id}
          cx={marking.cx}
          cy={marking.cy}
          r={marking.r}
          stroke={marking.filled ? "none" : stroke}
          strokeWidth={marking.filled ? 0 : sw}
          fill={marking.filled ? stroke : "none"}
        />
      );
    case "arc": {
      const cx = marking.cx ?? 0;
      const cy = marking.cy ?? 0;
      const r = marking.r ?? 0;
      const start = marking.startAngle ?? 0;
      const end = marking.endAngle ?? 0;

      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);

      let sweep = end - start;
      if (sweep < 0) sweep += 2 * Math.PI;
      const largeArc = sweep > Math.PI ? 1 : 0;

      return (
        <path
          key={marking.id}
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
        />
      );
    }
  }
}

export function PitchBackground({
  crop,
  orientation,
  side,
  colors,
  grass,
  precomputedMarkings,
}: Props) {
  const markings = precomputedMarkings ?? computePitchMarkings(crop, orientation, side);
  const boundary = markings.find((m) => m.id === "boundary");

  return (
    <g data-stadia="pitch-background">
      {boundary && (
        <rect
          key="pitch-bg"
          x={boundary.x}
          y={boundary.y}
          width={boundary.width}
          height={boundary.height}
          fill={colors.fill}
          stroke="none"
        />
      )}
      {grass && boundary && (
        <GrassPatternDefs
          pattern={grass}
          orientation={orientation}
          baseFill={colors.fill}
          pitchX={boundary.x ?? 0}
          pitchY={boundary.y ?? 0}
          pitchW={boundary.width ?? 0}
          pitchH={boundary.height ?? 0}
        />
      )}
    </g>
  );
}

export function PitchLines({
  crop,
  orientation,
  side,
  colors,
  precomputedMarkings,
}: Omit<Props, "grass">) {
  const markings = precomputedMarkings ?? computePitchMarkings(crop, orientation, side);

  return (
    <g data-stadia="pitch-lines">{markings.map((m) => renderMarking(m, colors.lines))}</g>
  );
}

export function PitchMarkings({ crop, orientation, side, colors, grass }: Props) {
  const markings = computePitchMarkings(crop, orientation, side);
  return (
    <>
      <PitchBackground
        crop={crop}
        orientation={orientation}
        side={side}
        colors={colors}
        grass={grass}
        precomputedMarkings={markings}
      />
      <PitchLines
        crop={crop}
        orientation={orientation}
        side={side}
        colors={colors}
        precomputedMarkings={markings}
      />
    </>
  );
}
