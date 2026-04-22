import { cleanup, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import { Formation } from "../src/Formation";
import type { FormationTeamSpec } from "../src/Formation";
import { formationMarkerPresets } from "../src/primitives/formationMarkerPresets";
import { MarkerIcon } from "../src/primitives/MarkerIcon";
import { MarkerPill } from "../src/primitives/MarkerPill";
import { RatingPill } from "../src/primitives/PlayerBadges";

afterEach(cleanup);

function parseTranslate(transform: string | null): { x: number; y: number } {
  const match = (transform ?? "").match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) {
    throw new Error(`expected translate(...) transform, got ${transform ?? "null"}`);
  }
  return {
    x: Number.parseFloat(match[1]!),
    y: Number.parseFloat(match[2]!),
  };
}

describe("<Formation /> — single team", () => {
  it("renders 11 markers for zero-config 4-3-3", () => {
    const { container } = render(<Formation formation="4-3-3" />);
    const markers = container.querySelectorAll(
      '[data-testid="formation-marker"], [data-testid="formation-marker-placeholder"]',
    );
    expect(markers.length).toBe(11);
  });

  it("renders 11 markers for zero-config 4231 (non-hyphenated)", () => {
    const { container } = render(<Formation formation="4231" />);
    const markers = container.querySelectorAll(
      '[data-testid="formation-marker"], [data-testid="formation-marker-placeholder"]',
    );
    expect(markers.length).toBe(11);
  });

  it("applies an intrinsic max width by default and lets callers override root style", () => {
    const { container, rerender } = render(<Formation formation="4-3-3" />);

    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root).toHaveStyle({ maxWidth: "440px", width: "100%" });

    rerender(
      <Formation formation="4-3-3" style={{ maxWidth: 300, marginInline: "auto" }} />,
    );

    expect(root).toHaveStyle({ maxWidth: "300px", marginInline: "auto" });
  });

  it("renders position codes when no players supplied", () => {
    const { container } = render(<Formation formation="4-3-3" />);
    const labels = container.querySelectorAll('[data-testid="formation-marker-label"]');
    const texts = Array.from(labels).map((el) => el.textContent);
    expect(texts).toContain("GK");
    // 4-3-3 should expose recognisable outfield codes too.
    expect(texts.length).toBe(11);
  });

  it("renders jersey numbers when players supplied with numbers", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          { label: "Raya", number: 1 },
          { label: "White", number: 2 },
        ]}
      />,
    );
    const labels = container.querySelectorAll('[data-testid="formation-marker-label"]');
    const texts = Array.from(labels).map((el) => el.textContent);
    expect(texts).toContain("1");
    expect(texts).toContain("2");
  });

  it("renders a captain mark when captain: true", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[{ label: "Ødegaard", number: 8, captain: true, slot: 8 }]}
        {...formationMarkerPresets.minimal()}
      />,
    );
    const captainMarks = container.querySelectorAll('[data-testid="formation-captain"]');
    expect(captainMarks.length).toBe(1);
  });

  it("renders dashed placeholders for empty slots", () => {
    const { container } = render(
      <Formation formation="4-3-3" players={[{ label: "Raya", number: 1 }]} />,
    );
    const placeholders = container.querySelectorAll(
      '[data-testid="formation-marker-placeholder"]',
    );
    const filled = container.querySelectorAll('[data-testid="formation-marker"]');
    expect(placeholders.length).toBe(10);
    expect(filled.length).toBe(1);
  });

  it("keeps a red-carded player as a regular filled marker with a red card badge", () => {
    // Regression guard: earlier versions documented "drop the sent-off
    // player to a dashed placeholder", which is not how any real lineup
    // graphic renders a dismissal. The player must stay in their slot
    // and the red card badge makes the dismissal visible.
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[{ label: "Calafiori", number: 33, redCard: true, slot: 5 }]}
        {...formationMarkerPresets.minimal()}
      />,
    );
    const filled = container.querySelectorAll('[data-testid="formation-marker"]');
    const placeholders = container.querySelectorAll(
      '[data-testid="formation-marker-placeholder"]',
    );
    const redCards = container.querySelectorAll('[data-testid="formation-red-card"]');
    expect(filled.length).toBe(1);
    expect(placeholders.length).toBe(10);
    expect(redCards.length).toBe(1);
  });

  it("renders a yellow card badge when yellowCard is true", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[{ label: "Ødegaard", number: 8, yellowCard: true, slot: 7 }]}
        {...formationMarkerPresets.minimal()}
      />,
    );
    const yellowCards = container.querySelectorAll(
      '[data-testid="formation-yellow-card"]',
    );
    expect(yellowCards.length).toBe(1);
  });

  it("prioritises red card over yellow card when both flags are set", () => {
    // A second yellow triggers a red; the visible badge should be the
    // red card only, not both stacked. The minimal preset implements
    // this priority directly in its slot composition.
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          { label: "Player", number: 99, yellowCard: true, redCard: true, slot: 7 },
        ]}
        {...formationMarkerPresets.minimal()}
      />,
    );
    expect(container.querySelectorAll('[data-testid="formation-red-card"]').length).toBe(
      1,
    );
    expect(
      container.querySelectorAll('[data-testid="formation-yellow-card"]').length,
    ).toBe(0);
  });

  it("renders a sub-minute badge when subMinute is set", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[{ label: "Havertz", number: 29, subMinute: 76, slot: 11 }]}
        {...formationMarkerPresets.minimal()}
      />,
    );
    const subs = container.querySelectorAll('[data-testid="formation-sub-minute"]');
    expect(subs.length).toBe(1);
  });

  it("can stack captain + yellow card + sub minute on a single player", () => {
    // Captain in topLeft, card in left, sub minute in topLeft (replaces
    // captain when present). Verify card renders alongside sub minute.
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          {
            label: "Ødegaard",
            number: 8,
            captain: true,
            yellowCard: true,
            subMinute: 76,
            slot: 7,
          },
        ]}
        {...formationMarkerPresets.minimal()}
      />,
    );
    // Sub minute takes topLeft (captain displaced when sub minute present).
    expect(
      container.querySelectorAll('[data-testid="formation-sub-minute"]').length,
    ).toBe(1);
    // Card renders in the left slot.
    expect(
      container.querySelectorAll('[data-testid="formation-yellow-card"]').length,
    ).toBe(1);
  });

  it("honours per-icon colour overrides via the marker slot composition", () => {
    // Colour overrides are applied on the specific MarkerIcon being composed:
    // pass a `color` to the icon you want recoloured.
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[{ label: "Player", number: 99, redCard: true, slot: 7 }]}
        markerComposition={{
          slots: ({ r }) => ({
            bottomRight: <MarkerIcon kind="red-card" r={r} color="#ff00ff" />,
          }),
        }}
      />,
    );
    const redCardRect = container.querySelector(
      '[data-testid="formation-red-card"] rect',
    );
    expect(redCardRect?.getAttribute("fill")).toBe("#ff00ff");
  });

  it("supports callback-driven glyph kind, fill, and name-pill styling", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          { label: "Keeper", number: 1, slot: 1 },
          { label: "Winger", number: 7, slot: 11 },
        ]}
        markers={{
          glyphKind: ({ player }) => (player.number === 1 ? "shirt" : "circle"),
          fill: ({ player }) => (player.number === 1 ? "#123456" : "#abcdef"),
        }}
        markerLabels={{
          background: ({ player }) => (player.number === 1 ? "#010203" : undefined),
          color: ({ player }) => (player.number === 1 ? "#fefefe" : undefined),
        }}
      />,
    );

    const shirtGlyph = container.querySelector('[data-glyph-kind="shirt"] path');
    expect(shirtGlyph).not.toBeNull();
    expect(shirtGlyph).toHaveAttribute("fill", "#123456");

    const circleGlyph = container.querySelector('[data-glyph-kind="circle"] circle');
    expect(circleGlyph).not.toBeNull();
    expect(circleGlyph).toHaveAttribute("fill", "#abcdef");

    const namePill = Array.from(
      container.querySelectorAll('[data-role="marker-decorations"] rect'),
    ).find((rect) => rect.getAttribute("fill") === "#010203");
    expect(namePill).not.toBeNull();
  });

  // -------------------------------------------------------------------
  // Marker slot composition (replaces the old `features` prop)
  // -------------------------------------------------------------------

  it("does not render rich decorations when marker is omitted", () => {
    // Without `marker`, the marker is just a circle + jersey label + name
    // pill — none of the rich primitives appear in the DOM, regardless of
    // what data the player carries.
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          {
            label: "Salah",
            number: 11,
            slot: 9,
            photo: "https://example.test/salah.jpg",
            rating: 8.4,
            nationality: "🇪🇬",
            age: 33,
            transferValue: "£45M",
            goals: 2,
            assists: 1,
            subMinute: 76,
          },
        ]}
      />,
    );
    expect(container.querySelector('[data-testid="formation-avatar"]')).toBeNull();
    expect(container.querySelector('[data-testid="formation-rating"]')).toBeNull();
    expect(container.querySelector('[data-testid="formation-flag"]')).toBeNull();
    expect(container.querySelector('[data-testid="formation-marker-pill"]')).toBeNull();
  });

  it("renders each primitive when composed via marker.slots", () => {
    // Walk every primitive the slot system can render and assert that
    // each one shows up in the DOM with its expected testid. The slot
    // composition is intentionally explicit per case rather than relying
    // on a preset, so this test stays a regression guard for the
    // primitive-to-testid mapping.
    const player = {
      label: "Rice",
      number: 41,
      slot: 6,
      photo: "https://example.test/rice.jpg",
      rating: 7.8,
      nationality: "ENG",
      age: 26,
      transferValue: "£105M",
      substituted: true,
      yellowCard: true,
    };

    type Case = {
      label: string;
      glyph?: "circle" | "photo" | "shirt";
      slot: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "bottom";
      node: (r: number) => React.ReactNode;
      testId: string;
    };
    const cases: Case[] = [
      {
        label: "rating pill",
        slot: "topRight",
        node: (r) => <RatingPill r={r} rating={player.rating} />,
        testId: "formation-rating",
      },
      {
        label: "nationality flag",
        slot: "topLeft",
        node: (r) => <MarkerIcon kind="flag" r={r} label={player.nationality} />,
        testId: "formation-flag",
      },
      {
        label: "age pill",
        slot: "topRight",
        node: (r) => <MarkerPill r={r} text={player.age} />,
        testId: "formation-marker-pill",
      },
      {
        label: "captain icon",
        slot: "topLeft",
        node: (r) => <MarkerIcon kind="captain" r={r} />,
        testId: "formation-captain",
      },
      {
        label: "yellow card icon",
        slot: "bottomRight",
        node: (r) => <MarkerIcon kind="yellow-card" r={r} />,
        testId: "formation-yellow-card",
      },
      {
        label: "sub icon",
        slot: "bottomLeft",
        node: (r) => <MarkerIcon kind="sub" r={r} />,
        testId: "formation-substitution",
      },
      {
        label: "photo glyph",
        glyph: "photo",
        slot: "topRight",
        node: () => null,
        testId: "formation-avatar",
      },
    ];

    for (const c of cases) {
      const { container } = render(
        <Formation
          formation="4-3-3"
          players={[player]}
          markerComposition={{
            ...(c.glyph !== undefined ? { glyph: c.glyph } : {}),
            slots: ({ r }) => ({ [c.slot]: c.node(r) }),
          }}
        />,
      );
      expect(
        container.querySelector(`[data-testid="${c.testId}"]`),
        `${c.label} → ${c.testId}`,
      ).not.toBeNull();
      cleanup();
    }
  });

  it("colour-grades the rating pill across thresholds", () => {
    // Three players in low / mid / high bands — resulting pill fills
    // should be three distinct colours. The rating pill is the same
    // primitive as before; only the way it gets composed has changed.
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          { label: "Low", number: 1, slot: 1, rating: 5.0 },
          { label: "Mid", number: 2, slot: 2, rating: 6.5 },
          { label: "High", number: 3, slot: 3, rating: 8.0 },
        ]}
        markerComposition={{
          slots: ({ player, r }) =>
            player.rating != null
              ? { topRight: <RatingPill r={r} rating={player.rating} /> }
              : {},
        }}
      />,
    );
    const ratingFills = Array.from(
      container.querySelectorAll('[data-testid="formation-rating"] rect'),
    ).map((r) => r.getAttribute("fill"));
    const unique = new Set(ratingFills.filter((f): f is string => f !== null));
    expect(unique.size).toBe(3);
  });

  it("shifts the decorations group inward for a wide-edge player (clamp integration)", () => {
    // F12: layout-engine clamping was unit-tested in markerLayout.test.ts
    // but never verified end-to-end through the React tree. Render a
    // right-wing player with a wide MarkerPill in the `right` slot —
    // wide enough that the decoration extent overflows the pitch
    // boundary. Assert the `<g data-role="marker-decorations">`
    // transform's x shift is negative (decorations shift left).
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          {
            label: "Saka",
            number: 7,
            slot: 9, // RW — projected near the right edge in 4-3-3
          },
        ]}
        markerComposition={{
          slots: ({ r }) => ({
            right: <MarkerPill r={r} text="VERY LONG VALUE LABEL" />,
          }),
        }}
      />,
    );
    const rightSlot = container.querySelector(
      '[data-testid="formation-marker-slot-right"]',
    );
    expect(rightSlot).not.toBeNull();
    const decorationsGroup = rightSlot!.closest('[data-role="marker-decorations"]');
    expect(decorationsGroup).not.toBeNull();
    const transform = decorationsGroup!.getAttribute("transform") ?? "";
    // Parse `translate(dx dy)` — dx should be negative (shift left).
    const match = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
    expect(match, `transform should be a translate, got: ${transform}`).not.toBeNull();
    const dx = Number.parseFloat(match![1]!);
    expect(dx).toBeLessThan(0);
  });

  it("stacks multiple goal icons in a single bottomRight slot", () => {
    // The slot system's stacking is what makes "two goals → two icons"
    // possible — in the old features model the user had no way to opt
    // into more than one goal indicator. This test documents the new
    // capability.
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[{ label: "Haaland", number: 9, slot: 9, goals: 2 }]}
        markerComposition={{
          slots: ({ player, r }) => ({
            bottomRight:
              player.goals != null && player.goals > 0
                ? Array.from({ length: player.goals }, (_, i) => (
                    <MarkerIcon key={`goal-${i}`} kind="goal" r={r} />
                  ))
                : null,
          }),
        }}
      />,
    );
    expect(container.querySelectorAll('[data-testid="formation-goal"]').length).toBe(2);
  });

  // -------------------------------------------------------------------
  // Substitutes bench
  // -------------------------------------------------------------------

  it("renders a substitutes bench on the right for vertical single-team by default", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        substitutes={[
          { label: "Sub 1", number: 16 },
          { label: "Sub 2", number: 17 },
          { label: "Sub 3", number: 18 },
        ]}
      />,
    );
    const bench = container.querySelector('[data-testid="formation-subs-bench"]');
    expect(bench).not.toBeNull();
    expect(bench?.getAttribute("data-placement")).toBe("right");
    expect(
      container.querySelectorAll('[data-testid="formation-subs-bench-entry"]').length,
    ).toBe(3);
  });

  it("defaults the bench to bottom for horizontal single-team", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        attackingDirection="right"
        substitutes={[{ label: "Sub 1", number: 16 }]}
      />,
    );
    const bench = container.querySelector('[data-testid="formation-subs-bench"]');
    expect(bench?.getAttribute("data-placement")).toBe("bottom");
  });

  it("honours an explicit substitutesPlacement override", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        substitutes={[{ label: "Sub 1", number: 16 }]}
        substitutesPlacement="left"
      />,
    );
    expect(
      container
        .querySelector('[data-testid="formation-subs-bench"]')
        ?.getAttribute("data-placement"),
    ).toBe("left");
  });

  it("does not render a bench when substitutes is empty or undefined", () => {
    const { container: empty } = render(<Formation formation="4-3-3" substitutes={[]} />);
    expect(empty.querySelector('[data-testid="formation-subs-bench"]')).toBeNull();

    const { container: none } = render(<Formation formation="4-3-3" />);
    expect(none.querySelector('[data-testid="formation-subs-bench"]')).toBeNull();
  });

  it("renders one bench per team for dual-team vertical with opposite placements", () => {
    const { container } = render(
      <Formation
        home={{
          label: "Arsenal",
          formation: "4-3-3",
          substitutes: [{ label: "H1", number: 16 }],
        }}
        away={{
          label: "Tottenham",
          formation: "4-4-2",
          substitutes: [{ label: "A1", number: 12 }],
        }}
      />,
    );
    const benches = Array.from(
      container.querySelectorAll('[data-testid="formation-subs-bench"]'),
    );
    expect(benches.length).toBe(2);
    const placements = benches.map((b) => b.getAttribute("data-placement")).sort();
    // Vertical dual: away on top, home on bottom
    expect(placements).toEqual(["bottom", "top"]);
  });

  it("flips dual-team bench placements for horizontal orientation", () => {
    const { container } = render(
      <Formation
        attackingDirection="right"
        home={{
          label: "Arsenal",
          formation: "4-3-3",
          substitutes: [{ label: "H1", number: 16 }],
        }}
        away={{
          label: "Tottenham",
          formation: "4-4-2",
          substitutes: [{ label: "A1", number: 12 }],
        }}
      />,
    );
    const placements = Array.from(
      container.querySelectorAll('[data-testid="formation-subs-bench"]'),
    )
      .map((b) => b.getAttribute("data-placement"))
      .sort();
    // Horizontal dual: away on left, home on right
    expect(placements).toEqual(["left", "right"]);
  });

  it("propagates card badges onto bench entries", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        substitutes={[
          { label: "Sub 1", number: 16, yellowCard: true },
          { label: "Sub 2", number: 17, redCard: true },
        ]}
      />,
    );
    // The PlayerStatusBadges primitive used by each bench row renders
    // the same testids as on the pitch, so card tests carry over.
    expect(
      container.querySelectorAll('[data-testid="formation-yellow-card"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      container.querySelectorAll('[data-testid="formation-red-card"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("hides the in-marker jersey label when the photo glyph is enabled", () => {
    // The jersey label element stays in the tree (for a11y and existing
    // tests that query it) but renders invisibly so the photo is the
    // visual focus. Scope the query to the filled marker because the
    // other 10 slots are placeholders with their own label elements
    // (rendered at opacity 0.7 for the position code).
    const { container } = render(
      <Formation
        formation="4-3-3"
        players={[
          {
            label: "Rice",
            number: 41,
            slot: 6,
            photo: "https://example.test/rice.jpg",
          },
        ]}
        markerComposition={{ glyph: "photo" }}
      />,
    );
    const filledMarker = container.querySelector('[data-testid="formation-marker"]');
    const jerseyLabel = filledMarker?.querySelector(
      '[data-testid="formation-marker-label"]',
    );
    expect(jerseyLabel).not.toBeNull();
    expect(jerseyLabel?.getAttribute("opacity")).toBe("0");
  });

  it("throws on invalid formation string", () => {
    // React logs the error to stderr before rethrowing — that's expected
    // behaviour; the assertion here is just that the render() call throws.
    expect(() => render(<Formation formation="4-3-4" />)).toThrow(/unknown formation/);
  });

  it("has root svg with role='img' and non-empty aria-label", () => {
    const { container } = render(<Formation formation="4-3-3" teamLabel="Arsenal" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    const ariaLabel = svg?.getAttribute("aria-label") ?? "";
    expect(ariaLabel.length).toBeGreaterThan(0);
    expect(ariaLabel).toContain("Arsenal");
    expect(ariaLabel).toContain("4-3-3");
  });

  it("is axe-clean for a zero-config formation", async () => {
    const { container } = render(<Formation formation="4-3-3" />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("is axe-clean for a formation with players and a captain", async () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        teamLabel="Arsenal"
        players={[
          { label: "Raya", number: 1 },
          { label: "White", number: 2 },
          { label: "Saliba", number: 12 },
          { label: "Gabriel", number: 6 },
          { label: "Timber", number: 3 },
          { label: "Rice", number: 41 },
          { label: "Ødegaard", number: 8, captain: true },
          { label: "Havertz", number: 29 },
          { label: "Saka", number: 7 },
          { label: "Jesus", number: 9 },
          { label: "Martinelli", number: 11 },
        ]}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("supports horizontal orientation", () => {
    const { container } = render(
      <Formation formation="4-3-3" attackingDirection="right" />,
    );
    const markers = container.querySelectorAll(
      '[data-testid="formation-marker"], [data-testid="formation-marker-placeholder"]',
    );
    expect(markers.length).toBe(11);
  });

  it("keeps the goalkeeper in the visible box for default vertical half crop", () => {
    const { container } = render(<Formation formation="4-3-3" crop="half" />);
    const gk = container.querySelector('[data-testid="formation-marker-placeholder"]');
    const p = parseTranslate(gk?.getAttribute("transform") ?? null);
    // Default side is attack; Formation auto-flips in half-crop so the
    // keeper lands in the attacking/top penalty area.
    expect(p.y).toBeLessThan(17);
  });

  it("keeps the goalkeeper in the visible box for horizontal attack half crop", () => {
    const { container } = render(
      <Formation formation="4-3-3" crop="half" attackingDirection="right" />,
    );
    const gk = container.querySelector('[data-testid="formation-marker-placeholder"]');
    const p = parseTranslate(gk?.getAttribute("transform") ?? null);
    expect(p.x).toBeGreaterThan(88);
  });

  it("keeps the goalkeeper in the visible box for horizontal defend half crop", () => {
    const { container } = render(
      <Formation
        formation="4-3-3"
        crop="half"
        attackingDirection="right"
        side="defend"
      />,
    );
    const gk = container.querySelector('[data-testid="formation-marker-placeholder"]');
    const p = parseTranslate(gk?.getAttribute("transform") ?? null);
    expect(p.x).toBeLessThan(17);
  });

  it("honours flip=false as a half-crop override", () => {
    const { container } = render(
      <Formation formation="4-3-3" crop="half" attackingDirection="right" flip={false} />,
    );
    const gk = container.querySelector('[data-testid="formation-marker-placeholder"]');
    const p = parseTranslate(gk?.getAttribute("transform") ?? null);
    expect(p.x).toBeLessThan(70);
  });

  it("flip=true on full pitch moves the goalkeeper to the opposite side", () => {
    const { container } = render(<Formation formation="4-3-3" flip />);
    const gk = container.querySelector('[data-testid="formation-marker-placeholder"]');
    const p = parseTranslate(gk?.getAttribute("transform") ?? null);
    expect(p.y).toBeLessThan(20);
  });
});

describe("Formation — dual team", () => {
  const homeTeam: FormationTeamSpec = {
    label: "Arsenal",
    formation: "4-3-3",
    players: [{ label: "Raya", number: 1 }],
    color: "#e50027",
  };
  const awayTeam: FormationTeamSpec = {
    label: "Liverpool",
    formation: "4-2-3-1",
    players: [{ label: "Alisson", number: 1 }],
    color: "#c8102e",
  };

  it("renders 22 markers (11 per team) for dual-team mode", () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const markers = container.querySelectorAll('[data-testid="formation-marker"]');
    const placeholders = container.querySelectorAll(
      '[data-testid="formation-marker-placeholder"]',
    );
    expect(markers.length + placeholders.length).toBe(22);
  });

  it("renders the home team marker color for home players", () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const homeMarkers = container.querySelectorAll('[data-team="home"] circle[fill]');
    const filled = Array.from(homeMarkers).filter(
      (c) => c.getAttribute("fill") === homeTeam.color,
    );
    expect(filled.length).toBeGreaterThan(0);
  });

  it("renders a two-item legend when both teams have labels", () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const legendItems = container.querySelectorAll(
      '[data-testid="formation-legend-item"]',
    );
    expect(legendItems.length).toBe(2);
  });

  it("suppresses legend when neither team has a label", () => {
    const homeNoLabel: FormationTeamSpec = {
      formation: "4-3-3",
      players: [{ label: "Raya", number: 1 }],
      color: "#e50027",
    };
    const awayNoLabel: FormationTeamSpec = {
      formation: "4-2-3-1",
      players: [{ label: "Alisson", number: 1 }],
      color: "#c8102e",
    };
    const { container } = render(<Formation home={homeNoLabel} away={awayNoLabel} />);
    const legend = container.querySelector('[data-testid="formation-legend"]');
    expect(legend).toBeNull();
  });

  it("builds an aria-label mentioning both teams and formations", () => {
    const { container } = render(<Formation home={homeTeam} away={awayTeam} />);
    const svg = container.querySelector("svg");
    const ariaLabel = svg?.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("Arsenal");
    expect(ariaLabel).toContain("Liverpool");
    expect(ariaLabel).toContain("4-3-3");
  });

  it("supports horizontal orientation for dual-team mode", () => {
    const { container } = render(
      <Formation home={homeTeam} away={awayTeam} attackingDirection="right" />,
    );
    const markers = container.querySelectorAll(
      '[data-testid="formation-marker"], [data-testid="formation-marker-placeholder"]',
    );
    expect(markers.length).toBe(22);
    const svg = container.querySelector("svg");
    const viewBox = svg?.getAttribute("viewBox") ?? "";
    // Horizontal pitch viewBox is 105×68 (length × width).
    const [, , w, h] = viewBox.split(" ").map(Number);
    expect(w).toBeGreaterThan(h as number);
  });

  it("renders legend by default and respects legendPlacement='none'", () => {
    const { container: withLegend } = render(
      <Formation home={homeTeam} away={awayTeam} />,
    );
    expect(withLegend.querySelector('[data-testid="formation-legend"]')).not.toBeNull();

    const { container: noLegend } = render(
      <Formation home={homeTeam} away={awayTeam} legendPlacement="none" />,
    );
    expect(noLegend.querySelector('[data-testid="formation-legend"]')).toBeNull();
  });
});
