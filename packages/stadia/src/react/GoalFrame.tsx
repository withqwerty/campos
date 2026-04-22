import { GOAL } from "../geometry/constants.js";

type Props = {
  colors: {
    frame: string;
    net: string;
    ground: string;
    background: string;
    floor: string;
  };
  netStyle: "none" | "light" | "dense";
  netShape: "flat" | "box";
  netBackInset: number;
  netBackOffsetTop: number;
  netBackOffsetBottom: number;
  netOpacity: number;
  groundExtension: number;
  netThickness: number;
  groundThickness: number;
  barThickness: number;
  netColumns: number;
  netRows: number;
};

/**
 * Grid lines are positioned on the playfield — the rectangle bounded by the
 * inside edges of the posts and crossbar — so spacing is uniform regardless
 * of bar thickness. Uses integer iteration to avoid floating-point drift
 * across steps.
 */
function buildNetLines(
  style: "none" | "light" | "dense",
  columns: number,
  rows: number,
  leftPostX: number,
  rightPostX: number,
  crossbarY: number,
  groundY: number,
) {
  if (style === "none") return { verticals: [], horizontals: [] } as const;

  const resolvedColumns = Math.max(1, columns);
  const resolvedRows = Math.max(1, rows);
  const playfieldWidth = rightPostX - leftPostX;
  const playfieldHeight = groundY - crossbarY;
  const verticalStep = playfieldWidth / (resolvedColumns + 1);
  const horizontalStep = playfieldHeight / (resolvedRows + 1);

  const verticals: number[] = [];
  const horizontals: number[] = [];

  for (let i = 1; i <= resolvedColumns; i += 1) {
    verticals.push(leftPostX + i * verticalStep);
  }
  for (let i = 1; i <= resolvedRows; i += 1) {
    horizontals.push(crossbarY + i * horizontalStep);
  }

  return { verticals, horizontals } as const;
}

function buildBoxNetGeometry(
  leftPostX: number,
  rightPostX: number,
  crossbarY: number,
  groundY: number,
  netBackInset: number,
  netBackOffsetTop: number,
  netBackOffsetBottom: number,
) {
  const maxBackInset = Math.max(0, (rightPostX - leftPostX) / 2 - 0.1);
  const resolvedBackInset = Math.max(0, Math.min(netBackInset, maxBackInset));
  const resolvedBackOffsetTop = Math.max(
    0,
    Math.min(netBackOffsetTop, groundY - crossbarY - 0.2),
  );
  const resolvedBackOffsetBottom = Math.max(
    0,
    Math.min(netBackOffsetBottom, groundY - crossbarY - resolvedBackOffsetTop - 0.1),
  );

  return {
    front: {
      left: leftPostX,
      right: rightPostX,
      top: crossbarY,
      bottom: groundY,
    },
    back: {
      left: leftPostX + resolvedBackInset,
      right: rightPostX - resolvedBackInset,
      top: crossbarY + resolvedBackOffsetTop,
      bottom: groundY - resolvedBackOffsetBottom,
    },
  } as const;
}

export function GoalFrame({
  colors,
  netStyle,
  netShape,
  netBackInset,
  netBackOffsetTop,
  netBackOffsetBottom,
  netOpacity,
  groundExtension,
  netThickness,
  groundThickness,
  barThickness,
  netColumns,
  netRows,
}: Props) {
  const inset = barThickness / 2;
  const leftPostX = inset;
  const rightPostX = GOAL.width - inset;
  const crossbarY = inset;
  const groundY = GOAL.depth;
  const { verticals, horizontals } = buildNetLines(
    netStyle,
    netColumns,
    netRows,
    leftPostX,
    rightPostX,
    crossbarY,
    groundY,
  );
  const framePath = `M ${leftPostX} ${groundY} L ${leftPostX} ${crossbarY} L ${rightPostX} ${crossbarY} L ${rightPostX} ${groundY}`;
  const boxNet = buildBoxNetGeometry(
    leftPostX,
    rightPostX,
    crossbarY,
    groundY,
    netBackInset,
    netBackOffsetTop,
    netBackOffsetBottom,
  );
  const panelFillOpacity = Math.min(0.14, netOpacity * 0.22);

  return (
    <g data-stadia="goal-frame">
      {colors.background !== "transparent" && (
        <rect
          x={0}
          y={0}
          width={GOAL.width}
          height={GOAL.depth}
          fill={colors.background}
          stroke="none"
        />
      )}
      {netStyle !== "none" &&
        (netShape === "box" ? (
          <g
            data-stadia="goal-net-shape-box"
            stroke={colors.net}
            strokeOpacity={netOpacity}
            strokeWidth={netThickness}
            fill="none"
          >
            {colors.floor !== "transparent" ? (
              <polygon
                data-stadia="goal-floor"
                points={`${boxNet.front.left},${boxNet.front.bottom} ${boxNet.back.left},${boxNet.back.bottom} ${boxNet.back.right},${boxNet.back.bottom} ${boxNet.front.right},${boxNet.front.bottom}`}
                fill={colors.floor}
                stroke="none"
              />
            ) : null}
            <polygon
              points={`${boxNet.front.left},${boxNet.front.top} ${boxNet.front.right},${boxNet.front.top} ${boxNet.back.right},${boxNet.back.top} ${boxNet.back.left},${boxNet.back.top}`}
              fill={colors.net}
              fillOpacity={panelFillOpacity}
              stroke="none"
            />
            <polygon
              points={`${boxNet.front.left},${boxNet.front.top} ${boxNet.back.left},${boxNet.back.top} ${boxNet.back.left},${boxNet.back.bottom} ${boxNet.front.left},${boxNet.front.bottom}`}
              fill={colors.net}
              fillOpacity={panelFillOpacity}
              stroke="none"
            />
            <polygon
              points={`${boxNet.front.right},${boxNet.front.top} ${boxNet.back.right},${boxNet.back.top} ${boxNet.back.right},${boxNet.back.bottom} ${boxNet.front.right},${boxNet.front.bottom}`}
              fill={colors.net}
              fillOpacity={panelFillOpacity}
              stroke="none"
            />
            <path
              d={`M ${boxNet.back.left} ${boxNet.back.bottom} L ${boxNet.back.left} ${boxNet.back.top} L ${boxNet.back.right} ${boxNet.back.top} L ${boxNet.back.right} ${boxNet.back.bottom} Z`}
            />
            <line
              x1={boxNet.front.left}
              y1={boxNet.front.top}
              x2={boxNet.back.left}
              y2={boxNet.back.top}
            />
            <line
              x1={boxNet.front.right}
              y1={boxNet.front.top}
              x2={boxNet.back.right}
              y2={boxNet.back.top}
            />
            <line
              x1={boxNet.front.left}
              y1={boxNet.front.bottom}
              x2={boxNet.back.left}
              y2={boxNet.back.bottom}
            />
            <line
              x1={boxNet.front.right}
              y1={boxNet.front.bottom}
              x2={boxNet.back.right}
              y2={boxNet.back.bottom}
            />
            {verticals.map((x) => {
              const t = (x - leftPostX) / (rightPostX - leftPostX);
              const backX = boxNet.back.left + t * (boxNet.back.right - boxNet.back.left);
              return (
                <g key={`net-box-v-${x}`}>
                  <line x1={x} y1={boxNet.front.top} x2={backX} y2={boxNet.back.top} />
                  <line
                    x1={backX}
                    y1={boxNet.back.top}
                    x2={backX}
                    y2={boxNet.back.bottom}
                  />
                </g>
              );
            })}
            {horizontals.map((y) => {
              const t = (y - crossbarY) / (groundY - crossbarY);
              const backY = boxNet.back.top + t * (boxNet.back.bottom - boxNet.back.top);
              return (
                <g key={`net-box-h-${y}`}>
                  <line x1={boxNet.front.left} y1={y} x2={boxNet.back.left} y2={backY} />
                  <line
                    x1={boxNet.front.right}
                    y1={y}
                    x2={boxNet.back.right}
                    y2={backY}
                  />
                  <line
                    x1={boxNet.back.left}
                    y1={backY}
                    x2={boxNet.back.right}
                    y2={backY}
                  />
                </g>
              );
            })}
          </g>
        ) : (
          <g stroke={colors.net} strokeOpacity={netOpacity} strokeWidth={netThickness}>
            {verticals.map((x) => (
              <line key={`net-v-${x}`} x1={x} y1={crossbarY} x2={x} y2={groundY} />
            ))}
            {horizontals.map((y) => (
              <line key={`net-h-${y}`} x1={leftPostX} y1={y} x2={rightPostX} y2={y} />
            ))}
          </g>
        ))}
      {/* Posts + crossbar only; bottom edge stays open like a plotting scaffold.
          `strokeLinecap="butt"` truncates the posts exactly at the ground line
          so they don't bleed half a stroke-width below it — previously a square
          linecap extended each post into (and past) the ground-line stroke. */}
      <path
        d={framePath}
        stroke={colors.frame}
        strokeWidth={barThickness}
        strokeLinejoin="miter"
        strokeLinecap="butt"
        fill="none"
      />
      {/* Ground line */}
      <line
        x1={-groundExtension}
        y1={groundY}
        x2={GOAL.width + groundExtension}
        y2={groundY}
        stroke={colors.ground}
        strokeWidth={groundThickness}
      />
    </g>
  );
}
