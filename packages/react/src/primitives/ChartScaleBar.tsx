import type { UITheme } from "../theme.js";

export type ScaleBarStop = {
  offset: number;
  color: string;
};

export function ChartScaleBar({
  label,
  startLabel,
  endLabel,
  stops,
  testId,
  theme,
}: {
  label: string;
  startLabel: string;
  endLabel: string;
  stops: readonly ScaleBarStop[];
  testId?: string;
  theme: UITheme;
}) {
  return (
    <div {...(testId ? { "data-testid": testId } : {})}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: 12,
          color: theme.text.muted,
        }}
      >
        <span>{label}</span>
        <span>
          {startLabel} – {endLabel}
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: theme.radius.pill,
          background: `linear-gradient(90deg, ${stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(", ")})`,
        }}
      />
    </div>
  );
}
