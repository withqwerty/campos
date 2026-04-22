import { describe, expect, it } from "vitest";

import type { Event } from "@withqwerty/campos-schema";
import type { StatsBombEvent, StatsBombMatchInfo } from "../../src/statsbomb/parse";
import { fromStatsBomb } from "../../src/index";

import sampleEvents from "../fixtures/statsbomb/raw-match-events-sample.json";

// JSON imports infer number[] for tuples — cast once at the boundary.
const sampleEventsTyped = sampleEvents.event as unknown as StatsBombEvent[];

const matchInfo: StatsBombMatchInfo = {
  id: sampleEvents.matchInfo.id,
  homeTeam: sampleEvents.matchInfo.homeTeam,
  awayTeam: sampleEvents.matchInfo.awayTeam,
};

describe("fromStatsBomb.events — mixed event stream", () => {
  const events = fromStatsBomb.events(sampleEventsTyped, matchInfo);

  it("returns both shot and pass event kinds", () => {
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds).toContain("shot");
    expect(kinds).toContain("pass");
  });

  it("maps the correct number of shots and passes", () => {
    const shots = events.filter((e) => e.kind === "shot");
    const passes = events.filter((e) => e.kind === "pass");

    // The raw fixture includes all event kinds: shots, passes, carry, duel/tackle,
    // interception, foul, goalkeeper, clearance, and substitution.
    expect(shots).toHaveLength(8);
    expect(passes).toHaveLength(8);
    expect(events).toHaveLength(23);
  });

  it("every event has valid base fields", () => {
    for (const event of events) {
      expect(event.kind).toBeDefined();
      expect(typeof event.id).toBe("string");
      expect(event.id.length).toBeGreaterThan(0);
      expect(event.provider).toBe("statsbomb");
      expect(typeof event.second).toBe("number");
      expect(event.second).toBeGreaterThanOrEqual(0);
      expect(typeof event.minute).toBe("number");
      expect(event.minute).toBeGreaterThanOrEqual(0);
      expect(event.period).toBeGreaterThanOrEqual(1);
      expect(event.period).toBeLessThanOrEqual(5);
      expect(typeof event.matchId).toBe("string");
      expect(typeof event.teamId).toBe("string");
      expect(typeof event.providerEventId).toBe("string");
    }
  });

  it("pass events carry endX, endY, passType, and isAssist", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");

    for (const pass of passes) {
      expect(pass).toHaveProperty("endX");
      expect(pass).toHaveProperty("endY");
      expect(pass).toHaveProperty("passType");
      expect(pass).toHaveProperty("isAssist");
      expect(typeof pass.isAssist).toBe("boolean");
    }
  });

  it("pass with goal_assist=true has isAssist=true", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const assist = passes.find(
      (p) => p.providerEventId === "b9dc3ef6-4336-4f16-aeed-71898b37c4c4",
    );

    expect(assist).toBeDefined();
    const a = assist as NonNullable<typeof assist>;
    expect(a.isAssist).toBe(true);
    expect(a.recipient).toBe("Florian Wirtz");
  });

  it("classifies cross correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const cross = passes.find(
      (p) => p.providerEventId === "70dd2d8f-fd79-42bc-a266-dd7ac417b3ce",
    );

    expect(cross).toBeDefined();
    expect((cross as NonNullable<typeof cross>).passType).toBe("cross");
  });

  it("classifies through-ball correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const throughBall = passes.find(
      (p) => p.providerEventId === "b9dc3ef6-4336-4f16-aeed-71898b37c4c4",
    );

    expect(throughBall).toBeDefined();
    expect((throughBall as NonNullable<typeof throughBall>).passType).toBe(
      "through-ball",
    );
  });

  it("classifies throw-in correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const throwIn = passes.find(
      (p) => p.providerEventId === "6567c05f-4310-473f-a783-71d373c9be1f",
    );

    expect(throwIn).toBeDefined();
    expect((throwIn as NonNullable<typeof throwIn>).passType).toBe("throw-in");
  });

  it("classifies goal kick correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const goalKick = passes.find(
      (p) => p.providerEventId === "6368bac9-cfc5-43d9-b938-17c5beb68b58",
    );

    expect(goalKick).toBeDefined();
    expect((goalKick as NonNullable<typeof goalKick>).passType).toBe("goal-kick");
  });

  it("classifies corner correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const corner = passes.find(
      (p) => p.providerEventId === "f11e6dbe-665c-4c05-a7cb-aa361d8a0bf2",
    );

    expect(corner).toBeDefined();
    expect((corner as NonNullable<typeof corner>).passType).toBe("corner");
  });

  it("classifies kick-off correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const kickOff = passes.find(
      (p) => p.providerEventId === "221b0c8d-6386-4ae8-bb4a-a1dc98742312",
    );

    expect(kickOff).toBeDefined();
    expect((kickOff as NonNullable<typeof kickOff>).passType).toBe("kick-off");
  });

  it("classifies free-kick pass correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const freeKick = passes.find(
      (p) => p.providerEventId === "3ce3802e-45c8-43f7-a1f3-04ee67992cb8",
    );

    expect(freeKick).toBeDefined();
    expect((freeKick as NonNullable<typeof freeKick>).passType).toBe("free-kick");
  });

  it("scales pass length from yards to Campos units", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const pass = passes.find(
      (p) => p.providerEventId === "ff56e821-21e9-4cef-ba2a-7eb5eb3769c6",
    );

    expect(pass).toBeDefined();
    // 24.041006 yards * (100/120) ≈ 20.03
    expect((pass as NonNullable<typeof pass>).length).toBeCloseTo(20.03, 2);
  });

  it("defaults to ground pass when no special pass type applies", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const ground = passes.find(
      (p) => p.providerEventId === "ff56e821-21e9-4cef-ba2a-7eb5eb3769c6",
    );

    expect(ground).toBeDefined();
    expect((ground as NonNullable<typeof ground>).passType).toBe("ground");
  });

  it("pass end coordinates are in 0-100 range", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");

    for (const pass of passes) {
      if (pass.endX != null) {
        expect(pass.endX).toBeGreaterThanOrEqual(0);
        expect(pass.endX).toBeLessThanOrEqual(100);
      }
      if (pass.endY != null) {
        expect(pass.endY).toBeGreaterThanOrEqual(0);
        expect(pass.endY).toBeLessThanOrEqual(100);
      }
    }
  });

  it("returns empty array for empty input", () => {
    const result = fromStatsBomb.events([] as StatsBombEvent[], matchInfo);
    expect(result).toEqual([]);
  });
});
