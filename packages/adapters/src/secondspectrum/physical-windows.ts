import type { PhysicalWindow } from "@withqwerty/campos-schema";

export type SecondSpectrumPhysicalWindowInput = {
  rowId?: string | number | null;
  subjectKind: "team" | "player";
  subjectId: string | number;
  subjectName?: string | null;
  side?: "home" | "away" | null;
  phase?: PhysicalWindow["phase"];
  label: string;
  startMinute?: number | null;
  endMinute?: number | null;
  distance?: number | null;
  highSpeedRunning?: number | null;
  sprinting?: number | null;
  highIntensityRuns?: number | null;
  highSpeedRunningCount?: number | null;
  sprintingCount?: number | null;
  topSpeed?: number | null;
  averageSpeed?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumPhysicalWindowOptions = {
  matchId: string;
  provider?: string;
};

export type SecondSpectrumPhysicalSummaryRow = {
  optaId: string | number;
  player?: string | null;
  playerName?: string | null;
  side?: "home" | "away" | null;
  teamSide?: "home" | "away" | null;
  minutes?: string | number | null;
  distance?: number | null;
  highSpeedRunning?: number | null;
  sprinting?: number | null;
  highIntensityRuns?: number | null;
  distanceTip?: number | null;
  distanceOtip?: number | null;
  distanceBop?: number | null;
  topSpeed?: number | null;
  averageSpeed?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumPhysicalSummaryOptions = SecondSpectrumPhysicalWindowOptions & {
  label?: string;
  phase?: PhysicalWindow["phase"];
};

export type SecondSpectrumPhysicalSplitMetric = {
  label: string;
  values: readonly (number | null | undefined)[];
};

export type SecondSpectrumTeamPhysicalSplitBlockInput = {
  subjectId: string | number;
  subjectName?: string | null;
  teamLabel?: string | null;
  side?: "home" | "away" | null;
  phase?: PhysicalWindow["phase"];
  minuteMarks: readonly string[];
  metrics: readonly SecondSpectrumPhysicalSplitMetric[];
  sourceMeta?: Record<string, unknown> | null;
};

export type SecondSpectrumTeamPhysicalSplitOptions =
  SecondSpectrumPhysicalWindowOptions & {
    splitMinutes?: number;
  };

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function physicalWindow(
  row: SecondSpectrumPhysicalWindowInput,
  options: SecondSpectrumPhysicalWindowOptions,
): PhysicalWindow {
  const providerRowId =
    row.rowId == null ? `${row.subjectId}:${row.label}` : String(row.rowId);
  return {
    id: `${options.matchId}:second-spectrum:physical:${providerRowId}`,
    matchId: options.matchId,
    subjectKind: row.subjectKind,
    subjectId: String(row.subjectId),
    subjectName: row.subjectName ?? null,
    side: row.side ?? null,
    phase: row.phase ?? "all",
    label: row.label,
    startMinute: nullableNumber(row.startMinute),
    endMinute: nullableNumber(row.endMinute),
    metrics: {
      distance: nullableNumber(row.distance),
      highSpeedRunning: nullableNumber(row.highSpeedRunning),
      sprinting: nullableNumber(row.sprinting),
      highIntensityRuns: nullableNumber(row.highIntensityRuns),
      highSpeedRunningCount: nullableNumber(row.highSpeedRunningCount),
      sprintingCount: nullableNumber(row.sprintingCount),
      topSpeed: nullableNumber(row.topSpeed),
      averageSpeed: nullableNumber(row.averageSpeed),
    },
    provider: options.provider ?? "second-spectrum",
    providerRowId,
    sourceMeta: row.sourceMeta ?? null,
  };
}

export function physicalWindows(
  rows: readonly SecondSpectrumPhysicalWindowInput[],
  options: SecondSpectrumPhysicalWindowOptions,
): PhysicalWindow[] {
  return rows.map((row) => physicalWindow(row, options));
}

export function physicalSummaryWindow(
  row: SecondSpectrumPhysicalSummaryRow,
  options: SecondSpectrumPhysicalSummaryOptions,
): PhysicalWindow {
  const label = options.label ?? "full match";
  return physicalWindow(
    {
      rowId: `${row.optaId}:${label.replace(/\s+/g, "-")}`,
      subjectKind: "player",
      subjectId: row.optaId,
      subjectName: row.playerName ?? row.player ?? null,
      side: row.side ?? row.teamSide ?? null,
      phase: options.phase ?? "all",
      label,
      distance: nullableNumber(row.distance),
      highSpeedRunning: nullableNumber(row.highSpeedRunning),
      sprinting: nullableNumber(row.sprinting),
      highIntensityRuns: nullableNumber(row.highIntensityRuns),
      topSpeed: nullableNumber(row.topSpeed),
      averageSpeed: nullableNumber(row.averageSpeed),
      sourceMeta: {
        source: "Second Spectrum PhysicalSummary CSV",
        minutes: row.minutes ?? null,
        distanceTip: nullableNumber(row.distanceTip),
        distanceOtip: nullableNumber(row.distanceOtip),
        distanceBop: nullableNumber(row.distanceBop),
        ...(row.sourceMeta ?? {}),
      },
    },
    options,
  );
}

export function physicalSummaryWindows(
  rows: readonly SecondSpectrumPhysicalSummaryRow[],
  options: SecondSpectrumPhysicalSummaryOptions,
): PhysicalWindow[] {
  return rows.map((row) => physicalSummaryWindow(row, options));
}

function splitMetricValue(
  block: SecondSpectrumTeamPhysicalSplitBlockInput,
  label: string,
  index: number,
): number | null {
  const value = block.metrics.find((metric) => metric.label === label)?.values[index];
  return nullableNumber(value);
}

function splitWindowBounds(
  minuteMarks: readonly string[],
  index: number,
  splitMinutes: number,
): { startMinute: number | null; endMinute: number | null; label: string } {
  const endMinute = Number.parseFloat(minuteMarks[index] ?? "");
  if (!Number.isFinite(endMinute)) {
    return {
      startMinute: null,
      endMinute: null,
      label: minuteMarks[index] ?? `split ${index + 1}`,
    };
  }
  const previous = Number.parseFloat(minuteMarks[index - 1] ?? "");
  const startMinute =
    index === 0
      ? Math.max(0, endMinute - splitMinutes)
      : Number.isFinite(previous) && endMinute > previous
        ? previous
        : Math.max(0, endMinute - splitMinutes);
  return {
    startMinute,
    endMinute,
    label: `${startMinute}-${endMinute}`,
  };
}

export function physicalTeamSplitWindows(
  block: SecondSpectrumTeamPhysicalSplitBlockInput,
  options: SecondSpectrumTeamPhysicalSplitOptions,
): PhysicalWindow[] {
  const splitMinutes = options.splitMinutes ?? 5;
  const subjectLabel = block.teamLabel ?? block.subjectName ?? String(block.subjectId);

  return block.minuteMarks.map((_, index) => {
    const { startMinute, endMinute, label } = splitWindowBounds(
      block.minuteMarks,
      index,
      splitMinutes,
    );

    return physicalWindow(
      {
        rowId: `${block.side ?? block.subjectId}:team-split:${index}`,
        subjectKind: "team",
        subjectId: block.subjectId,
        subjectName: block.subjectName ?? block.teamLabel ?? null,
        side: block.side ?? null,
        phase: block.phase ?? "all",
        label,
        startMinute,
        endMinute,
        distance: splitMetricValue(block, "Total Distance", index),
        highSpeedRunning: splitMetricValue(block, "High Speed Running Distance", index),
        sprinting: splitMetricValue(block, "Sprinting Distance", index),
        highSpeedRunningCount: splitMetricValue(block, "High Speed Running Count", index),
        sprintingCount: splitMetricValue(block, "Sprinting Count", index),
        sourceMeta: {
          source: "Second Spectrum PhysicalSplits CSV",
          providerIndex: index,
          evidence: [
            `Second Spectrum PhysicalSplits CSV row ${subjectLabel}, provider split ${index + 1}`,
            "Metrics preserve total distance, HSR distance, sprint distance, HSR count, and sprint count where present.",
          ],
          caveat:
            "Second Spectrum split marks include a half-time separator and repeated minute labels. Use providerIndex/source metadata when aligning ambiguous split windows to video or event time.",
          ...(block.sourceMeta ?? {}),
        },
      },
      options,
    );
  });
}

export function physicalTeamSplitBlocks(
  blocks: readonly SecondSpectrumTeamPhysicalSplitBlockInput[],
  options: SecondSpectrumTeamPhysicalSplitOptions,
): PhysicalWindow[] {
  return blocks.flatMap((block) => physicalTeamSplitWindows(block, options));
}
