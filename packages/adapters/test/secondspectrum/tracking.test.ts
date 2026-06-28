import { describe, expect, it } from "vitest";

import { fromSecondSpectrum } from "../../src/secondspectrum/index.js";

const pitchDimensions = { length: 105, width: 68 };

describe("Second Spectrum adapter", () => {
  it("converts centred metric tracking co-ordinates into absolute Campos pitch space", () => {
    expect(fromSecondSpectrum.metricToCampos([-52.5, -34], pitchDimensions)).toEqual({
      x: 0,
      y: 0,
    });
    expect(fromSecondSpectrum.metricToCampos([0, 0], pitchDimensions)).toEqual({
      x: 50,
      y: 50,
    });
    expect(fromSecondSpectrum.metricToCampos([52.5, 34], pitchDimensions)).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("builds a loss-aware tracking frame without forcing attacker-relative event co-ordinates", () => {
    const frame = fromSecondSpectrum.trackingFrame(
      {
        period: 1,
        frameIdx: 6250,
        gameClock: 250,
        wallClock: 123456,
        live: true,
        homePlayers: [
          {
            playerId: "ssi-home-1",
            optaId: 11,
            number: 9,
            xyz: [10.5, -17, 0],
            speed: 6.4,
          },
        ],
        awayPlayers: [
          {
            playerId: "ssi-away-1",
            number: "4",
            xyz: [-21, 17, 0],
          },
        ],
        ball: { xyz: [0, 0, 1.2], speed: 12.1 },
        sourceMeta: { lastTouch: "home" },
      },
      {
        matchId: "match-1",
        pitchDimensions,
        homeAttacksToward: "increasing-x",
      },
    );

    expect(frame.coordinateFrame).toBe("absolute-pitch");
    expect(frame.id).toBe("match-1:second-spectrum:frame:6250");
    expect(frame.players).toHaveLength(2);
    expect(frame.players[0]).toMatchObject({
      side: "home",
      playerId: "ssi-home-1",
      optaId: "11",
      shirtNumber: 9,
      x: 60,
      y: 25,
      speed: 6.4,
    });
    expect(frame.players[1]).toMatchObject({
      side: "away",
      optaId: null,
      shirtNumber: 4,
      x: 30,
      y: 75,
      speed: null,
    });
    expect(frame.ball).toMatchObject({ x: 50, y: 50, z: 1.2, speed: 12.1 });
    expect(frame.sourceMeta).toEqual({ lastTouch: "home" });
  });

  it("preserves physical-window missingness and possession-state phase", () => {
    const window = fromSecondSpectrum.physicalWindow(
      {
        rowId: "home-60-65-tip",
        subjectKind: "team",
        subjectId: "home",
        subjectName: "Liverpool",
        side: "home",
        phase: "in-possession",
        label: "60-65",
        startMinute: 60,
        endMinute: 65,
        distance: 510.2,
        highSpeedRunning: null,
        sprinting: 12.3,
        highSpeedRunningCount: 6,
        sprintingCount: 2,
        sourceMeta: { column: "TIP" },
      },
      { matchId: "match-1" },
    );

    expect(window).toMatchObject({
      id: "match-1:second-spectrum:physical:home-60-65-tip",
      phase: "in-possession",
      subjectKind: "team",
      side: "home",
      provider: "second-spectrum",
    });
    expect(window.metrics).toMatchObject({
      distance: 510.2,
      highSpeedRunning: null,
      sprinting: 12.3,
      highIntensityRuns: null,
      highSpeedRunningCount: 6,
      sprintingCount: 2,
      topSpeed: null,
      averageSpeed: null,
    });
  });

  it("maps parsed physical-summary rows into full-match player windows", () => {
    const [window] = fromSecondSpectrum.physicalSummaryWindows(
      [
        {
          optaId: 81780,
          player: "Mohamed Salah",
          teamSide: "home",
          minutes: "90+",
          distance: 10912.4,
          highSpeedRunning: 781.2,
          sprinting: 196.5,
          highIntensityRuns: 63,
          distanceTip: 4020.2,
          distanceOtip: 5103.1,
          distanceBop: 1789.1,
        },
      ],
      { matchId: "match-1" },
    );

    expect(window).toMatchObject({
      id: "match-1:second-spectrum:physical:81780:full-match",
      matchId: "match-1",
      subjectKind: "player",
      subjectId: "81780",
      subjectName: "Mohamed Salah",
      side: "home",
      phase: "all",
      label: "full match",
      providerRowId: "81780:full-match",
      sourceMeta: {
        source: "Second Spectrum PhysicalSummary CSV",
        minutes: "90+",
        distanceTip: 4020.2,
        distanceOtip: 5103.1,
        distanceBop: 1789.1,
      },
    });
    expect(window?.metrics).toMatchObject({
      distance: 10912.4,
      highSpeedRunning: 781.2,
      sprinting: 196.5,
      highIntensityRuns: 63,
      highSpeedRunningCount: null,
      sprintingCount: null,
    });
  });

  it("turns parsed team split blocks into source-backed physical windows", () => {
    const windows = fromSecondSpectrum.physicalTeamSplitWindows(
      {
        subjectId: "t1",
        subjectName: "Liverpool",
        teamLabel: "Liverpool FC (LIV)",
        side: "home",
        minuteMarks: ["5", "10", "45", "45", "50"],
        metrics: [
          { label: "Total Distance", values: [540, 511, 489, 0, 502] },
          {
            label: "High Speed Running Distance",
            values: [44, null, 28, 0, 31],
          },
          { label: "Sprinting Distance", values: [8, 5, 3, 0, 6] },
          { label: "High Speed Running Count", values: [4, undefined, 2, 0, 3] },
          { label: "Sprinting Count", values: [1, 1, 0, 0, 2] },
        ],
      },
      { matchId: "match-1" },
    );

    expect(windows).toHaveLength(5);
    expect(windows[0]).toMatchObject({
      id: "match-1:second-spectrum:physical:home:team-split:0",
      subjectKind: "team",
      subjectId: "t1",
      subjectName: "Liverpool",
      side: "home",
      label: "0-5",
      startMinute: 0,
      endMinute: 5,
      providerRowId: "home:team-split:0",
      metrics: {
        distance: 540,
        highSpeedRunning: 44,
        sprinting: 8,
        highSpeedRunningCount: 4,
        sprintingCount: 1,
      },
    });
    expect(windows[1]?.metrics.highSpeedRunning).toBeNull();
    expect(windows[1]?.metrics.highSpeedRunningCount).toBeNull();
    expect(windows[3]).toMatchObject({
      label: "40-45",
      startMinute: 40,
      endMinute: 45,
      sourceMeta: {
        source: "Second Spectrum PhysicalSplits CSV",
        providerIndex: 3,
      },
    });
    expect(windows[4]).toMatchObject({
      label: "45-50",
      startMinute: 45,
      endMinute: 50,
    });
  });

  it("keeps sequence sync separate from tactical classification", () => {
    const moment = fromSecondSpectrum.sequenceMoment(
      {
        id: "seq-1",
        title: "Line-break sequence",
        period: 2,
        minute: 67,
        second: 9,
        videoTimeSeconds: 5412,
        eventIds: [1001, "1002"],
        trackingFrameId: "match-1:second-spectrum:frame:10000",
        evidence: ["Opta event 1001", "Second Spectrum frame 10000"],
        caveat: "Nearest-frame sync; not body orientation evidence.",
      },
      { matchId: "match-1" },
    );

    expect(moment).toMatchObject({
      matchId: "match-1",
      videoTimeSeconds: 5412,
      eventIds: ["1001", "1002"],
      trackingFrameId: "match-1:second-spectrum:frame:10000",
      provider: "second-spectrum",
    });
    expect(moment).not.toHaveProperty("repeatability");
  });

  it("builds reusable team-shape overlays in Campos absolute pitch space", () => {
    const shape = fromSecondSpectrum.teamShapeSnapshot(
      {
        sequenceMomentId: "seq-1",
        trackingFrameId: "match-1:second-spectrum:frame:6250",
        lines: [
          {
            side: "home",
            line: "back",
            x: -21,
            evidence: ["deepest active outfield cluster"],
          },
        ],
        centroids: [{ side: "home", xy: [0, 0] }],
        polygons: [
          {
            side: "home",
            points: [
              [-10.5, -10.2],
              [10.5, -10.2],
              [0, 10.2],
            ],
            evidence: ["convex hull of observed player points"],
          },
        ],
        movements: [
          {
            side: "home",
            playerId: "ssi-home-1",
            optaId: 11,
            shirtNumber: "9",
            start: [0, 0],
            end: [6.3, 0],
            speed: 5.4,
            seconds: 0.04,
          },
        ],
        facingHints: [
          {
            side: "home",
            playerId: "ssi-home-1",
            optaId: 11,
            shirtNumber: 9,
            start: [0, 0],
            end: [3.15, 0],
            speed: 5.4,
            evidence: ["movement-derived facing cue"],
          },
        ],
        candidateLanes: [
          {
            side: "home",
            receiverOptaId: 11,
            receiverShirtNumber: 9,
            start: [0, 0],
            end: [21, 0],
            clearance: 3.2,
            blockers: 1,
            length: 21,
            evidence: ["ball-to-receiver segment"],
          },
        ],
        caveat: "Movement direction is not body orientation.",
      },
      { matchId: "match-1", pitchDimensions },
    );

    expect(shape).toMatchObject({
      id: "match-1:second-spectrum:team-shape:seq-1",
      matchId: "match-1",
      sequenceMomentId: "seq-1",
      trackingFrameId: "match-1:second-spectrum:frame:6250",
      coordinateFrame: "absolute-pitch",
      provider: "second-spectrum",
      caveat: "Movement direction is not body orientation.",
    });
    expect(shape.lines[0]).toMatchObject({
      side: "home",
      line: "back",
      x: 30,
      evidence: ["deepest active outfield cluster"],
    });
    expect(shape.centroids[0]).toMatchObject({ side: "home", x: 50, y: 50 });
    expect(shape.polygons[0]).toMatchObject({
      side: "home",
      method: "convex-hull",
      evidence: ["convex hull of observed player points"],
    });
    expect(shape.polygons[0]?.points).toHaveLength(3);
    expect(shape.movements[0]).toMatchObject({
      side: "home",
      playerId: "ssi-home-1",
      optaId: "11",
      shirtNumber: 9,
      x: 50,
      y: 50,
      endY: 50,
      speed: 5.4,
      seconds: 0.04,
    });
    expect(shape.movements[0]?.endX).toBeCloseTo(56);
    expect(shape.facingHints[0]).toMatchObject({
      side: "home",
      playerId: "ssi-home-1",
      optaId: "11",
      shirtNumber: 9,
      x: 50,
      y: 50,
      basis: "movement-vector",
      speed: 5.4,
      evidence: ["movement-derived facing cue"],
    });
    expect(shape.facingHints[0]?.endX).toBeCloseTo(53);
    expect(shape.candidateLanes[0]).toMatchObject({
      side: "home",
      receiverPlayerId: "11",
      receiverOptaId: "11",
      receiverShirtNumber: 9,
      x: 50,
      y: 50,
      endX: 70,
      endY: 50,
      clearance: 3.2,
      blockers: 1,
      length: 21,
    });
    expect(shape).not.toHaveProperty("repeatability");
    expect(shape).not.toHaveProperty("tacticalValue");
  });
});
